import "server-only";

import { z } from "zod";

import {
  type FipeMatchModel,
  type FipeVehicleIdentity,
  type FipeVehicleType,
  MATCHER_VERSION,
  rematchAllBelow,
} from "@/domain/listings/fipe-match";
import { type FipeMatchKind, type FipeMatchOrigin, Prisma } from "@/generated/prisma/client";

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

const matchRowSchema = z.object({
  id: z.string(),
  kind: z.enum(["version", "family", "none"]),
  reason: z.string().nullable(),
  vehicleType: z.number().int().nullable(),
  brandCode: z.string().nullable(),
  models: z.unknown(),
  origin: z.enum(["auto", "manual"]),
  matcherVersion: z.number().int(),
});

/**
 * Grava a escolha da regra em uma única ida ao banco. Correlação manual existente fica como está e é devolvida:
 * alguém a corrigiu enquanto a regra rodava, ou a chave já era manual.
 */
export async function saveAutoMatch(identity: FipeVehicleIdentity, choice: FipeMatchChoice): Promise<StoredFipeMatch> {
  const data = choiceData(choice);
  const rows = await db.$queryRaw<unknown[]>(Prisma.sql`
    WITH upserted AS (
      INSERT INTO fipe_matches (
        id, vehicle_key, brand, model, model_year, fuel, category,
        kind, reason, vehicle_type, brand_code, models, origin, matcher_version, updated_at
      )
      VALUES (
        ${crypto.randomUUID()}::uuid, ${identity.key}, ${identity.brand}, ${identity.model},
        ${identity.modelYear}::smallint, ${identity.fuel}, ${identity.category},
        ${data.kind}::fipe_match_kind, ${data.reason}, ${data.vehicleType}::smallint, ${data.brandCode},
        ${JSON.stringify(data.models)}::jsonb, 'auto'::fipe_match_origin, ${MATCHER_VERSION}::smallint, CURRENT_TIMESTAMP
      )
      ON CONFLICT (vehicle_key) DO UPDATE SET
        kind = EXCLUDED.kind,
        reason = EXCLUDED.reason,
        vehicle_type = EXCLUDED.vehicle_type,
        brand_code = EXCLUDED.brand_code,
        models = EXCLUDED.models,
        matcher_version = EXCLUDED.matcher_version,
        updated_at = CURRENT_TIMESTAMP
      WHERE fipe_matches.origin = 'auto'::fipe_match_origin
      RETURNING id::text AS id, kind::text AS kind, reason, vehicle_type::int AS "vehicleType",
        brand_code AS "brandCode", models, origin::text AS origin, matcher_version::int AS "matcherVersion"
    )
    SELECT id, kind, reason, "vehicleType", "brandCode", models, origin, "matcherVersion" FROM upserted
    UNION ALL
    SELECT id::text AS id, kind::text AS kind, reason, vehicle_type::int AS "vehicleType",
      brand_code AS "brandCode", models, origin::text AS origin, matcher_version::int AS "matcherVersion"
    FROM fipe_matches
    WHERE vehicle_key = ${identity.key} AND NOT EXISTS (SELECT 1 FROM upserted)
    LIMIT 1
  `);
  const [row] = z.array(matchRowSchema).min(1).parse(rows);
  if (!row) throw new Error(`Falha ao gravar correlação FIPE para ${identity.key}`);
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
      // Mesma condição de `needsRematch`: sem casamento de versão anterior, ou qualquer uma antes da última `all`.
      fipeMatch: {
        is: {
          origin: "auto",
          OR: [
            { kind: "none", matcherVersion: { lt: MATCHER_VERSION } },
            { matcherVersion: { lt: rematchAllBelow() } },
          ],
        },
      },
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
