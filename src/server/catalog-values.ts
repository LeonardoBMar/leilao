import "server-only";

import { cacheLife } from "next/cache";

import { distanceKm } from "@/domain/listings/geo";
import { DEFAULT_REGION } from "@/domain/listings/region";

import { db } from "./db";

/**
 * Valores de referência do catálogo global, com cache entre requisições (D-78). Não leem a sessão: quem chama exige.
 */

/**
 * Municípios a até `radiusKm` do centro da região, pela mesma `distanceKm` dos cartões. O filtro de raio vira
 * `municipality_id IN (...)` e fica exato no banco. A tabela é a carga do IBGE e não muda com o uso.
 */
export async function municipalitiesWithin(radiusKm: number): Promise<number[]> {
  "use cache";
  cacheLife("max");
  const municipalities = await db.municipality.findMany({
    select: { ibgeCode: true, latitude: true, longitude: true },
  });
  return municipalities.flatMap((municipality) =>
    distanceKm(DEFAULT_REGION.center, municipality) <= radiusKm ? [municipality.ibgeCode] : [],
  );
}

/** Grafias de combustível presentes no catálogo (poucas dezenas); a classificação é do domínio (`fuelOf`). */
export async function fuelSpellings(): Promise<string[]> {
  "use cache";
  cacheLife("catalog");
  const groups = await db.listing.groupBy({ by: ["fuel"], where: { fuel: { not: null } } });
  return groups.flatMap(({ fuel }) => (fuel === null ? [] : [fuel]));
}
