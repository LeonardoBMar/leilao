import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { type Coordinates, distanceKm } from "@/domain/listings/geo";
import { DEFAULT_REGION } from "@/domain/listings/region";

import { db } from "./db";

/**
 * Valores de referência do catálogo global, com cache entre requisições (D-78). Não leem a sessão: quem chama exige.
 */

export type CatalogMunicipality = {
  ibgeCode: number;
  name: string;
  state: string;
  nameKey: string;
  latitude: number;
  longitude: number;
};

/** Tabela estática do IBGE (~5.570 municípios), com cache máximo entre requisições (D-78). */
export async function loadAllMunicipalities(): Promise<CatalogMunicipality[]> {
  "use cache";
  cacheLife("max");
  cacheTag("catalog-municipalities");
  return db.municipality.findMany({
    orderBy: [{ name: "asc" }, { state: "asc" }],
    select: { ibgeCode: true, name: true, state: true, nameKey: true, latitude: true, longitude: true },
  });
}

/**
 * Municípios a até `radiusKm` do centro da região, pela mesma `distanceKm` dos cartões. O filtro de raio vira
 * `municipality_id IN (...)` e fica exato no banco. A tabela é a carga do IBGE e não muda com o uso.
 */
export async function municipalitiesWithin(
  radiusKm: number,
  center: Coordinates = DEFAULT_REGION.center,
): Promise<number[]> {
  "use cache";
  cacheLife("max");
  cacheTag("catalog-municipalities");
  const municipalities = await loadAllMunicipalities();
  return municipalities.flatMap((municipality) =>
    distanceKm(center, municipality) <= radiusKm ? [municipality.ibgeCode] : [],
  );
}

export type CatalogSource = { id: string; name: string; active: boolean };

/** Fontes registradas no catálogo (poucas linhas; só mudam quando uma fonte é adicionada ou pausada). */
export async function catalogSources(): Promise<CatalogSource[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag("catalog-sources");
  return db.source.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } });
}

/** Fontes ativas do catálogo, ordenadas pelo nome. */
export async function activeCatalogSources(): Promise<{ id: string; name: string }[]> {
  const sources = await catalogSources();
  return sources.flatMap(({ id, name, active }) => (active ? [{ id, name }] : []));
}

/** Grafias de combustível presentes no catálogo (poucas dezenas); a classificação é do domínio (`fuelOf`). */
export async function fuelSpellings(): Promise<string[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag("catalog-fuels");
  const groups = await db.listing.groupBy({ by: ["fuel"], where: { fuel: { not: null } } });
  return groups.flatMap(({ fuel }) => (fuel === null ? [] : [fuel]));
}
