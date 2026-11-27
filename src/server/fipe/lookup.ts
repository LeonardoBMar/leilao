import "server-only";

import type { MarketValueOrigin } from "@/domain/listings/fipe-match";
import type { Cents } from "@/domain/money";

import { createFipeCatalog } from "./catalog";
import { evaluateListing } from "./enrich";

export type FipeLookupResult = {
  value: Cents;
  fipeCode: string | null;
  refMonth: Date;
  origin: Extract<MarketValueOrigin, "fipe_version" | "fipe_family">;
  label: string;
};

/**
 * Consulta a tabela FIPE já importada no Postgres (`fipe_prices`) para um veículo arbitrário
 * (usado pelo Importador Universal e pela API v1, D-98). Sem pedidos HTTP externos e sem gravar em `fipe_matches`.
 */
export async function lookupVehicleFipe(input: {
  brand: string | null;
  model: string | null;
  vehicleVersion?: string | null;
  modelYear: number | null;
  fuel?: string | null;
  isMotorcycle?: boolean;
}): Promise<FipeLookupResult | null> {
  if (!input.brand || !input.model || input.modelYear === null) return null;

  const catalog = createFipeCatalog();
  const tables = await catalog.tables();
  if (tables.length === 0) return null;

  const fullModel = input.vehicleVersion ? `${input.model} ${input.vehicleVersion}`.trim() : input.model;
  const now = new Date();
  const sample = await evaluateListing(
    catalog,
    tables,
    {
      id: "00000000-0000-0000-0000-000000000000",
      title: `${input.brand} ${fullModel} ${input.modelYear}`,
      brand: input.brand,
      model: fullModel,
      modelYear: input.modelYear,
      fuel: input.fuel ?? null,
      category: input.isMotorcycle ? "Motos" : "Carros",
      status: "open",
      firstSeenAt: now,
      endsAt: null,
    },
    { dryRun: true },
  );

  if (sample.reason !== "matched" || !sample.match || !sample.referenceMonth) return null;

  return {
    value: sample.match.value,
    fipeCode: sample.match.fipeCode,
    refMonth: sample.referenceMonth,
    origin: sample.match.origin,
    label: sample.labels[0] ?? `${input.brand} ${fullModel}`,
  };
}
