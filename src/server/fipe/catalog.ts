import "server-only";

import { z } from "zod";

import {
  fipeFuelCodes,
  type FipeMatchModel,
  type FipeOption,
  type FipeTable,
  type FipeValue,
  type FipeVehicleType,
} from "@/domain/listings/fipe-match";
import { cents } from "@/domain/money";

import { db } from "../db";

/**
 * Catálogo de preços da FIPE no banco (D-49, D-51): a tabela de cada mês, importada do dataset fipeX
 * (`./dataset.ts`). Dá ao casamento as mesmas listas que a API da FIPE dava (tabelas, marcas, versões por ano e
 * combustível, valor), sem pedido a site nenhum. A marca é identificada pelo nome da FIPE e a versão pelo código FIPE.
 */
export type FipeCatalog = {
  tables: () => Promise<FipeTable[]>;
  brands: (table: FipeTable, type: FipeVehicleType) => Promise<FipeOption[]>;
  modelsByYear: (
    table: FipeTable,
    type: FipeVehicleType,
    brand: string,
    year: number,
    fuel: number,
  ) => Promise<FipeOption[]>;
  /** Valores das versões no ano, numa consulta; a versão sem preço na tabela fica de fora. */
  values: (
    table: FipeTable,
    year: number,
    models: readonly { code: string; fuel: number }[],
  ) => Promise<Map<string, FipeValue>>;
};

/**
 * Meses importados, do mais novo ao mais antigo. Salta de mês em mês pela PK (que começa pelo mês), em vez de agrupar
 * a tabela inteira: cada mês tem ~49 mil preços (D-79).
 */
export async function importedMonths(): Promise<Date[]> {
  const rows = await db.$queryRaw<unknown[]>`WITH RECURSIVE m AS (
      SELECT max(reference_month) AS month FROM fipe_prices
      UNION ALL
      SELECT (SELECT max(p.reference_month) FROM fipe_prices p WHERE p.reference_month < m.month) FROM m
      WHERE m.month IS NOT NULL
    )
    SELECT month FROM m WHERE month IS NOT NULL ORDER BY month DESC`;
  return z
    .array(z.object({ month: z.date() }))
    .parse(rows)
    .map((row) => row.month);
}

/** Código da tabela do mês no catálogo: "2026-10". */
export function fipeTableCode(month: Date): string {
  return month.toISOString().slice(0, 7);
}

/** Catálogo com memória: as listas lidas valem por toda a execução (a tabela de um mês não muda depois de importada). */
export function createFipeCatalog(): FipeCatalog {
  const memo = new Map<string, Promise<FipeOption[]>>();
  const remember = (key: string, load: () => Promise<FipeOption[]>) => {
    const known = memo.get(key);
    if (known) return known;
    const loading = load();
    memo.set(key, loading);
    // Falha não fica guardada: a próxima chamada tenta de novo.
    loading.catch(() => memo.delete(key));
    return loading;
  };

  return {
    async tables() {
      const months = await importedMonths();
      return months.map((month) => ({ code: fipeTableCode(month), month }));
    },
    brands(table, type) {
      return remember(`marcas:${table.code}:${type}`, async () => {
        const rows = await db.fipePrice.groupBy({
          by: ["brandName"],
          where: { referenceMonth: table.month, vehicleType: type },
          orderBy: { brandName: "asc" },
        });
        return rows.map(({ brandName }) => ({ code: brandName, label: brandName }));
      });
    },
    modelsByYear(table, type, brand, year, fuel) {
      return remember(`modelos:${table.code}:${type}:${brand}:${year}-${fuel}`, async () => {
        const rows = await db.fipePrice.groupBy({
          by: ["fipeCode", "modelName"],
          where: { referenceMonth: table.month, vehicleType: type, brandName: brand, modelYear: year, fuelCode: fuel },
          orderBy: { modelName: "asc" },
        });
        return rows.map(({ fipeCode, modelName }) => ({ code: fipeCode, label: modelName }));
      });
    },
    async values(table, year, models) {
      if (models.length === 0) return new Map();
      const rows = await db.fipePrice.findMany({
        where: {
          referenceMonth: table.month,
          modelYear: year,
          OR: models.map((model) => ({ fipeCode: model.code, fuelCode: model.fuel })),
        },
        select: { valueCents: true, fipeCode: true },
      });
      return new Map(rows.map((row) => [row.fipeCode, { value: cents(row.valueCents), fipeCode: row.fipeCode }]));
    },
  };
}

/** Carrega e deduplica as versões candidatas da FIPE para os combustíveis compatíveis de um veículo. */
export async function loadFipeModelCandidates(
  catalog: FipeCatalog,
  table: FipeTable,
  vehicleType: FipeVehicleType,
  brandCode: string,
  modelYear: number,
  rawFuel: string | null,
): Promise<FipeMatchModel[]> {
  const fuels = fipeFuelCodes(vehicleType, rawFuel);
  const byFuel = await Promise.all(
    fuels.map(async (fuel) => ({
      fuel,
      models: await catalog.modelsByYear(table, vehicleType, brandCode, modelYear, fuel),
    })),
  );
  const candidates: FipeMatchModel[] = [];
  for (const { fuel, models } of byFuel) {
    for (const model of models) {
      if (!candidates.some((item) => item.code === model.code)) {
        candidates.push({ code: model.code, fuel, label: model.label });
      }
    }
  }
  return candidates;
}
