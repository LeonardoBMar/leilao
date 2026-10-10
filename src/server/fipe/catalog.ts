import "server-only";

import { z } from "zod";

import {
  type FipeMatchModel,
  type FipeVehicleType,
  parseFipeMonth,
  type StoredFipePrice,
} from "@/domain/listings/fipe-match";
import { cents, parseBRL } from "@/domain/money";
import type { Prisma } from "@/generated/prisma/client";

import { db } from "../db";

/**
 * Catálogo de preços da FIPE (D-49): a resposta de cada valor pedido vira uma linha consultável de `fipe_prices`. Sai
 * das mesmas respostas guardadas em `fipe_responses`, sem pedido a mais, e pode ser reconstruído a partir delas.
 */

/** "valor:{tabela}:{tipo}:{marca}:{modelo}:{ano}-{combustível}", a chave do pedido de valor no cache. */
const VALUE_KEY = /^valor:(\d+):([123]):([^:]+):([^:]+):(\d{4})-([1-6])$/;

const valuePayloadSchema = z.object({
  Valor: z.string(),
  CodigoFipe: z.string().min(1),
  Marca: z.string().min(1),
  Modelo: z.string().min(1),
  MesReferencia: z.string(),
});

type FipePriceRow = Prisma.FipePriceCreateManyInput;

/** Linha do catálogo a partir de um pedido de valor guardado; nula se não for valor ou não tiver o formato. */
export function fipePriceFromResponse(key: string, payload: unknown): FipePriceRow | null {
  const keyParts = VALUE_KEY.exec(key);
  const parsed = valuePayloadSchema.safeParse(payload);
  if (!keyParts || !parsed.success) return null;
  const [, table, type, brandCode, modelCode, year, fuel] = keyParts;
  const value = parseBRL(parsed.data.Valor);
  const month = parseFipeMonth(parsed.data.MesReferencia);
  if (!table || !type || !brandCode || !modelCode || !year || !fuel || value === null || value <= 0 || !month) {
    return null;
  }
  return {
    referenceTable: Number(table),
    referenceMonth: month,
    vehicleType: Number(type),
    brandCode,
    brandName: parsed.data.Marca.trim(),
    modelCode,
    modelName: parsed.data.Modelo.trim(),
    modelYear: Number(year),
    fuelCode: Number(fuel),
    fipeCode: parsed.data.CodigoFipe.trim(),
    valueCents: value,
  };
}

/** Grava os preços que ainda não estão no catálogo (o preço de uma tabela não muda). */
export async function recordFipePrices(rows: readonly FipePriceRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { count } = await db.fipePrice.createMany({ data: [...rows], skipDuplicates: true });
  return count;
}

/** Reconstrói o catálogo a partir do cache de respostas. Idempotente; não pede nada à FIPE. */
export async function rebuildFipePrices(): Promise<{ read: number; added: number; skipped: number }> {
  const summary = { read: 0, added: 0, skipped: 0 };
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.fipeResponse.findMany({
      where: { key: { startsWith: "valor:" } },
      orderBy: { key: "asc" },
      take: 500,
      ...(cursor === undefined ? {} : { cursor: { key: cursor }, skip: 1 }),
      select: { key: true, payload: true },
    });
    if (batch.length === 0) return summary;
    cursor = batch.at(-1)?.key;
    const rows = batch.flatMap((item) => {
      const row = fipePriceFromResponse(item.key, item.payload);
      return row ? [row] : [];
    });
    summary.read += batch.length;
    summary.skipped += batch.length - rows.length;
    summary.added += await recordFipePrices(rows);
  }
}

/** Preços guardados das versões escolhidas, de todas as tabelas, para o valor provisório (`pickProvisionalPrices`). */
export async function findStoredPrices(input: {
  type: FipeVehicleType;
  brandCode: string;
  modelYear: number;
  models: readonly Pick<FipeMatchModel, "code" | "fuel">[];
}): Promise<StoredFipePrice[]> {
  if (input.models.length === 0) return [];
  const rows = await db.fipePrice.findMany({
    where: {
      vehicleType: input.type,
      brandCode: input.brandCode,
      modelYear: input.modelYear,
      OR: input.models.map((model) => ({ modelCode: model.code, fuelCode: model.fuel })),
    },
    select: {
      referenceTable: true,
      referenceMonth: true,
      modelCode: true,
      fuelCode: true,
      valueCents: true,
      fipeCode: true,
    },
  });
  return rows.map(({ valueCents, ...row }) => ({ ...row, value: cents(valueCents) }));
}
