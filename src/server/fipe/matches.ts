import "server-only";

import { z } from "zod";

import {
  type FipeMatchModel,
  type FipeVehicleIdentity,
  type FipeVehicleType,
  MATCHER_VERSION,
} from "@/domain/listings/fipe-match";
import type { FipeMatchKind, FipeMatchOrigin } from "@/generated/prisma/client";

import { db } from "../db";

/**
 * Correlação do veículo como a fonte escreve com a FIPE (D-49): uma escolha por chave, reaproveitada por todos os
 * anúncios iguais e em todos os meses (o código da versão é estável entre tabelas). A manual nunca é sobrescrita.
 */

const modelsSchema = z.array(z.object({ code: z.string().min(1), fuel: z.number().int(), label: z.string() }));

export type StoredFipeMatch = {
  id: string;
  kind: FipeMatchKind;
  reason: string | null;
  vehicleType: FipeVehicleType | null;
  brandCode: string | null;
  models: FipeMatchModel[];
  origin: FipeMatchOrigin;
  matcherVersion: number;
};

/** Escolha nova, antes de gravar: versão, família ou nenhuma (com o motivo). */
export type FipeMatchChoice =
  | { kind: "version" | "family"; vehicleType: FipeVehicleType; brandCode: string; models: FipeMatchModel[] }
  | { kind: "none"; reason: string; vehicleType: FipeVehicleType | null; brandCode: string | null };

const matchSelect = {
  id: true,
  kind: true,
  reason: true,
  vehicleType: true,
  brandCode: true,
  models: true,
  origin: true,
  matcherVersion: true,
} as const;

type MatchRow = {
  id: string;
  kind: FipeMatchKind;
  reason: string | null;
  vehicleType: number | null;
  brandCode: string | null;
  models: unknown;
  origin: FipeMatchOrigin;
  matcherVersion: number;
};

export function toStoredMatch(row: MatchRow): StoredFipeMatch {
  const models = modelsSchema.safeParse(row.models);
  return {
    id: row.id,
    kind: row.kind,
    reason: row.reason,
    vehicleType: toVehicleType(row.vehicleType),
    brandCode: row.brandCode,
    models: models.success ? models.data : [],
    origin: row.origin,
    matcherVersion: row.matcherVersion,
  };
}

function toVehicleType(value: number | null): FipeVehicleType | null {
  return value === 1 || value === 2 || value === 3 ? value : null;
}

export async function findFipeMatch(key: string): Promise<StoredFipeMatch | null> {
  const row = await db.fipeMatch.findUnique({ where: { vehicleKey: key }, select: matchSelect });
  return row ? toStoredMatch(row) : null;
}

function choiceData(choice: FipeMatchChoice) {
  return choice.kind === "none"
    ? {
        kind: choice.kind,
        reason: choice.reason,
        vehicleType: choice.vehicleType,
        brandCode: choice.brandCode,
        models: [],
      }
    : {
        kind: choice.kind,
        reason: null,
        vehicleType: choice.vehicleType,
        brandCode: choice.brandCode,
        models: choice.models,
      };
}

/**
 * Grava a escolha da regra. Correlação manual existente fica como está e é a devolvida: alguém a corrigiu enquanto a
 * regra rodava, ou a chave já era manual.
 */
export async function saveAutoMatch(identity: FipeVehicleIdentity, choice: FipeMatchChoice): Promise<StoredFipeMatch> {
  const data = { ...choiceData(choice), origin: "auto" as const, matcherVersion: MATCHER_VERSION };
  const vehicle = {
    vehicleKey: identity.key,
    brand: identity.brand,
    model: identity.model,
    modelYear: identity.modelYear,
    fuel: identity.fuel,
    category: identity.category,
  };
  await db.fipeMatch.upsert({ where: { vehicleKey: identity.key }, create: { ...vehicle, ...data }, update: {} });
  await db.fipeMatch.updateMany({ where: { vehicleKey: identity.key, origin: "auto" }, data });
  const row = await db.fipeMatch.findUniqueOrThrow({ where: { vehicleKey: identity.key }, select: matchSelect });
  return toStoredMatch(row);
}

/**
 * Correção do usuário: a escolha passa a ser manual e os anúncios ligados que não têm valor da fonte voltam a ficar
 * pendentes, para receber o valor da escolha nova na próxima execução. Devolve quantos anúncios voltaram.
 */
export async function setManualMatch(id: string, choice: FipeMatchChoice): Promise<number> {
  return db.$transaction(async (tx) => {
    await tx.fipeMatch.update({
      where: { id },
      data: { ...choiceData(choice), origin: "manual", matcherVersion: MATCHER_VERSION },
    });
    const { count } = await tx.listing.updateMany({
      where: { fipeMatchId: id, ...notFromSource },
      data: { marketValueCheckedAt: null },
    });
    return count;
  });
}

/** Desfaz a correção: a regra escolhe de novo na próxima execução. */
export async function resetMatchToAuto(id: string): Promise<number> {
  return db.$transaction(async (tx) => {
    await tx.fipeMatch.update({ where: { id }, data: { origin: "auto", matcherVersion: 0 } });
    const { count } = await tx.listing.updateMany({
      where: { fipeMatchId: id, ...notFromSource },
      data: { marketValueCheckedAt: null },
    });
    return count;
  });
}

/** Anúncios sem valor da fonte: o valor é do sistema (casado ou nenhum) e pode ser refeito. */
export const notFromSource = {
  OR: [{ marketValueOrigin: null }, { marketValueOrigin: { in: ["fipe_version" as const, "fipe_family" as const] } }],
};

/**
 * Regra nova (`MATCHER_VERSION` maior): os anúncios ligados a correlações automáticas de regra antiga voltam a ficar
 * pendentes; a correlação é refeita quando o primeiro deles for casado. Devolve quantos voltaram.
 */
export async function requeueStaleMatches(): Promise<number> {
  const { count } = await db.listing.updateMany({
    where: {
      marketValueCheckedAt: { not: null },
      fipeMatch: { is: { origin: "auto", matcherVersion: { lt: MATCHER_VERSION } } },
      ...notFromSource,
    },
    data: { marketValueCheckedAt: null },
  });
  return count;
}

export type FipeMatchListItem = StoredFipeMatch & {
  vehicleKey: string;
  modelYear: number;
  fuel: string | null;
  /** Anúncios ligados que não têm valor da fonte: os que uma correção afeta. */
  listings: number;
};

/** Correlações para o script de conferência (`db:fipe-match`), das que mais afetam anúncios às que menos. */
export async function listFipeMatches(filter: {
  kind?: FipeMatchKind;
  origin?: FipeMatchOrigin;
  search?: string;
  limit: number;
}): Promise<FipeMatchListItem[]> {
  const rows = await db.fipeMatch.findMany({
    where: {
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(filter.origin ? { origin: filter.origin } : {}),
      ...(filter.search ? { vehicleKey: { contains: filter.search.toUpperCase() } } : {}),
    },
    orderBy: { listings: { _count: "desc" } },
    take: filter.limit,
    select: {
      ...matchSelect,
      vehicleKey: true,
      modelYear: true,
      fuel: true,
      _count: { select: { listings: { where: notFromSource } } },
    },
  });
  return rows.map((row) => ({
    ...toStoredMatch(row),
    vehicleKey: row.vehicleKey,
    modelYear: row.modelYear,
    fuel: row.fuel,
    listings: row._count.listings,
  }));
}

export async function getFipeMatch(id: string): Promise<FipeMatchListItem | null> {
  const row = await db.fipeMatch.findUnique({
    where: { id },
    select: {
      ...matchSelect,
      vehicleKey: true,
      modelYear: true,
      fuel: true,
      _count: { select: { listings: { where: notFromSource } } },
    },
  });
  return row
    ? {
        ...toStoredMatch(row),
        vehicleKey: row.vehicleKey,
        modelYear: row.modelYear,
        fuel: row.fuel,
        listings: row._count.listings,
      }
    : null;
}
