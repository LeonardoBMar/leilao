import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { z } from "zod";

import { CATEGORY_OF_KEY } from "@/domain/listings/criteria";
import {
  availablePeriods,
  DAMAGE_OF_CONDITION,
  type ResearchCategory,
  type ResearchCondition,
  type ResearchFilters,
  vehicleLabel,
} from "@/domain/research/filters";
import { isStateCode, type StateCode } from "@/domain/research/states";
import { type ExcludedSales, type GroupSummary, RATIO_BOUNDS, summarize } from "@/domain/research/summary";
import { requireUser } from "@/server/auth";
import { catalogSources } from "@/server/catalog-values";

import type { ResearchFacets, ResearchOverview } from "../types";
import {
  cacheKeyFilters,
  levelSchema,
  MODEL_SUGGESTIONS_LIMIT,
  RATIO,
  RESEARCH_CACHE_TAG,
  rows,
  salesSince,
  salesWhere,
  sql,
  statsColumns,
  statsShape,
  toStats,
  VEHICLE_KEY,
} from "./sql";

/** Uma vez por requisição (cabeçalho e blocos usam a mesma base); entre requisições, o cache do catálogo (D-78). */
export const getResearchOverview = cache(async (): Promise<ResearchOverview> => {
  await requireUser();
  return loadResearchOverview();
});

async function loadResearchOverview(): Promise<ResearchOverview> {
  "use cache";
  cacheLife("catalog");
  cacheTag(RESEARCH_CACHE_TAG);
  const [row] = await rows(
    z.object({ sales: z.number().int(), fipeMatched: z.number().int(), since: z.date().nullable() }),
    sql`SELECT count(*)::int AS sales,
        count(*) FILTER (WHERE l.market_value_origin IN ('fipe_version', 'fipe_family'))::int AS "fipeMatched",
        min(l.ends_at) AS since FROM listings l
      WHERE l.status = 'sold' AND l.final_bid_cents > 0 AND l.ends_at >= ${salesSince()}`,
  );
  return row ?? { sales: 0, fipeMatched: 0, since: null };
}

/**
 * Contagens da barra de filtros: vendas por condição e por categoria (cada uma com os outros filtros) e os modelos com
 * venda na categoria e condição do filtro, para a busca.
 */
export async function getResearchFacets(filters: ResearchFilters): Promise<ResearchFacets> {
  await requireUser();
  return loadResearchFacets(cacheKeyFilters(filters));
}

async function loadResearchFacets(filters: ResearchFilters): Promise<ResearchFacets> {
  "use cache";
  cacheLife("catalog");
  cacheTag(RESEARCH_CACHE_TAG);
  const level = sql`coalesce(l.damage_level::text, 'unclassified')`;
  const withinKm = filters.maxKm === null ? sql`true` : sql`coalesce(l.mileage_km <= ${filters.maxKm}, false)`;
  const [{ since }, facetRows, sourceRows, byYear, models] = await Promise.all([
    loadResearchOverview(),
    rows(
      z.object({
        level: levelSchema,
        category: z.string().nullable(),
        state: z.string().nullable(),
        source_id: z.string(),
        within_km: z.boolean(),
        n: z.number().int(),
        known: z.number().int(),
      }),
      sql`SELECT ${level} AS level, l.category::text AS category, l.state::text AS state, l.source_id,
          ${withinKm} AS within_km, count(*)::int AS n, count(l.mileage_km)::int AS known
        FROM listings l
        WHERE ${salesWhere(filters, { condition: false, category: false, state: false, source: false, mileage: false })}
        GROUP BY 1, 2, 3, 4, 5`,
    ),
    catalogSources(),
    // Anos do modelo escolhido, sem o próprio filtro de ano (senão a lista encolheria para a faixa).
    filters.vehicle === null
      ? Promise.resolve([])
      : rows(
          z.object({ year: z.number().int(), n: z.number().int() }),
          sql`SELECT l.model_year::int AS year, count(*)::int AS n FROM listings l
            WHERE ${salesWhere({ ...filters, yearFrom: null, yearTo: null }, {})} AND l.model_year IS NOT NULL
            GROUP BY 1 ORDER BY 1 DESC`,
        ),
    rows(
      z.object({ key: z.string(), n: z.number().int() }),
      sql`SELECT t.key, count(*)::int AS n
        FROM (SELECT ${VEHICLE_KEY} AS key FROM listings l
          WHERE ${salesWhere({ ...filters, vehicle: null, state: null }, {})}) t
        WHERE t.key IS NOT NULL GROUP BY t.key ORDER BY 2 DESC, 1 LIMIT ${MODEL_SUGGESTIONS_LIMIT}`,
    ),
  ]);

  const targetCategory = CATEGORY_OF_KEY[filters.category];
  const targetLevel = DAMAGE_OF_CONDITION[filters.condition] ?? "unclassified";
  const levelCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const stateCounts: Partial<Record<StateCode, number>> = {};
  const sourceCounts = new Map<string, number>();
  let mileageTotal = 0;
  let mileageKnown = 0;

  for (const row of facetRows) {
    const matchCategory = row.category === targetCategory;
    const matchCondition = row.level === targetLevel;
    const matchState = filters.state === null || row.state === filters.state;
    const matchSource = filters.source === null || row.source_id === filters.source;
    const matchKm = filters.maxKm === null || row.within_km;

    if (matchCategory && matchState && matchSource && matchKm) {
      levelCounts.set(row.level, (levelCounts.get(row.level) ?? 0) + row.n);
    }
    if (matchCondition && matchState && matchSource && matchKm && row.category !== null) {
      categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + row.n);
    }
    if (matchCategory && matchCondition && matchSource && matchKm && row.state !== null && isStateCode(row.state)) {
      stateCounts[row.state] = (stateCounts[row.state] ?? 0) + row.n;
    }
    if (matchCategory && matchCondition && matchState && matchKm) {
      sourceCounts.set(row.source_id, (sourceCounts.get(row.source_id) ?? 0) + row.n);
    }
    if (matchCategory && matchCondition && matchState && matchSource) {
      mileageTotal += row.n;
      mileageKnown += row.known;
    }
  }

  const byCondition = (condition: ResearchCondition) =>
    levelCounts.get(DAMAGE_OF_CONDITION[condition] ?? "unclassified") ?? 0;
  const ofCategory = (category: ResearchCategory) => categoryCounts.get(CATEGORY_OF_KEY[category]) ?? 0;
  const sources = sourceRows
    .flatMap(({ id, name }) => {
      const sales = sourceCounts.get(id) ?? 0;
      return sales > 0 ? [{ id, name, sales }] : [];
    })
    .toSorted((a, b) => b.sales - a.sales || a.name.localeCompare(b.name));

  return {
    conditions: {
      "sem-monta": byCondition("sem-monta"),
      pequena: byCondition("pequena"),
      media: byCondition("media"),
      grande: byCondition("grande"),
      sucata: byCondition("sucata"),
    },
    categories: {
      carros: ofCategory("carros"),
      motos: ofCategory("motos"),
      utilitarios: ofCategory("utilitarios"),
      sucatas: ofCategory("sucatas"),
    },
    states: stateCounts,
    sources,
    mileage: { total: mileageTotal, known: mileageKnown },
    years: byYear.map(({ year, n }) => ({ year, sales: n })),
    models: models.flatMap(({ key, n }) => {
      const [brand = "", model = ""] = key.split("|");
      return brand && model ? [{ brand, model, label: vehicleLabel({ brand, model }), sales: n }] : [];
    }),
    periods: availablePeriods(since, new Date()),
  };
}

/** Vendas do filtro que ficam fora dos gráficos em %, por motivo. */
export const getExcludedSales = cache(async (filters: ResearchFilters): Promise<ExcludedSales> => {
  await requireUser();
  return loadExcludedSales(cacheKeyFilters(filters));
});

async function loadExcludedSales(filters: ResearchFilters): Promise<ExcludedSales> {
  "use cache";
  cacheLife("catalog");
  cacheTag(RESEARCH_CACHE_TAG);
  const [row] = await rows(
    z.object({ noMarketValue: z.number().int(), outOfBounds: z.number().int() }),
    sql`SELECT count(*) FILTER (WHERE coalesce(l.market_value_cents, 0) <= 0)::int AS "noMarketValue",
        count(*) FILTER (WHERE l.market_value_cents > 0
          AND ${RATIO} NOT BETWEEN ${RATIO_BOUNDS.min}::float8 AND ${RATIO_BOUNDS.max}::float8)::int AS "outOfBounds"
      FROM listings l WHERE ${salesWhere(filters, {})}`,
  );
  return row ?? { noMarketValue: 0, outOfBounds: 0 };
}

/** Lance final (centavos) de todas as vendas do filtro, para a leitura de um modelo em R$. */
export const getPriceSummary = cache(async (filters: ResearchFilters): Promise<GroupSummary> => {
  await requireUser();
  return loadPriceSummary(cacheKeyFilters(filters));
});

async function loadPriceSummary(filters: ResearchFilters): Promise<GroupSummary> {
  "use cache";
  cacheLife("catalog");
  cacheTag(RESEARCH_CACHE_TAG);
  const [row] = await rows(
    z.object(statsShape),
    sql`SELECT ${statsColumns(sql`l.final_bid_cents::float8`)} FROM listings l
      WHERE ${salesWhere(filters, {})} HAVING count(*) > 0`,
  );
  return summarize(row && toStats(row));
}
