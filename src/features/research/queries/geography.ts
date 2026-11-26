import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { z } from "zod";

import type { RegionConfig } from "@/domain/listings/region";
import { effectiveMetric, type ResearchFilters } from "@/domain/research/filters";
import { buildStateSummaries, isStateCode, type StateCode } from "@/domain/research/states";
import {
  DISTANCE_BAND_LIMITS,
  DISTANCE_BANDS,
  fillHistogram,
  type GroupStats,
  MIN_SAMPLE,
  ratioAxisMax,
  summarize,
} from "@/domain/research/summary";
import { getUserPreferences } from "@/features/preferences/queries";
import { requireUser } from "@/server/auth";

import type { StateDetail, StateMapView, WhereView } from "../types";
import { listSales, ratioDistribution } from "./shared";
import {
  cacheKeyFilters,
  distanceKmSql,
  RATIO,
  RESEARCH_CACHE_TAG,
  rows,
  salesWhere,
  sql,
  statsColumns,
  statsShape,
  toStats,
} from "./sql";

/** Mapa: um resumo por estado, em % do valor de mercado ou, com modelo, em lance final (centavos). */
export async function getStateMap(filters: ResearchFilters): Promise<StateMapView> {
  await requireUser();
  // `salesWhere` ignora `state`, e sem modelo a medida é sempre `ratio`: normalizar evita misses ao clicar nos estados.
  return loadStateMap({ ...cacheKeyFilters(filters, { keepMetric: filters.vehicle !== null }), state: null });
}

async function loadStateMap(filters: ResearchFilters): Promise<StateMapView> {
  "use cache";
  cacheLife("catalog");
  cacheTag(RESEARCH_CACHE_TAG);
  const metric = effectiveMetric(filters);
  const value = metric === "ratio" ? RATIO : sql`l.final_bid_cents::float8`;
  const byState = await rows(
    z.object({ state: z.string(), ...statsShape }),
    sql`SELECT l.state AS state, ${statsColumns(value)} FROM listings l
      WHERE ${salesWhere(filters, { state: false, ratio: metric === "ratio" })} AND l.state IS NOT NULL
      GROUP BY l.state`,
  );
  const stats: Partial<Record<StateCode, GroupStats>> = {};
  for (const row of byState) if (isStateCode(row.state)) stats[row.state] = toStats(row);
  return { metric, states: buildStateSummaries(stats) };
}

/**
 * "Onde" (docs/PLANO-MERCADO.md §6): o resumo por faixa de distância da região padrão e por estado e fonte, com todos
 * os filtros e na medida do mapa (% da FIPE ou, com modelo, lance final).
 */
export const getWhereView = cache(async (filters: ResearchFilters): Promise<WhereView> => {
  await requireUser();
  const { region } = await getUserPreferences();
  // `loadWhereView` só usa centro e rótulo (não `radiusKm`) e sem modelo a medida é sempre `ratio`.
  return loadWhereView(cacheKeyFilters(filters, { keepMetric: filters.vehicle !== null }), {
    ...region,
    radiusKm: 0,
  });
});

async function loadWhereView(filters: ResearchFilters, region: RegionConfig): Promise<WhereView> {
  "use cache";
  cacheLife("catalog");
  cacheTag(RESEARCH_CACHE_TAG);
  const metric = effectiveMetric(filters);
  const value = metric === "ratio" ? RATIO : sql`l.final_bid_cents::float8`;
  const where = salesWhere(filters, { ratio: metric === "ratio" });
  const [byDistance, byPlace] = await Promise.all([
    rows(
      z.object({ band: z.enum(DISTANCE_BANDS).nullable(), ...statsShape }),
      sql`SELECT CASE
          WHEN d.km IS NULL THEN NULL
          WHEN d.km <= ${DISTANCE_BAND_LIMITS.ate100}::int THEN 'ate100'
          WHEN d.km <= ${DISTANCE_BAND_LIMITS.ate300}::int THEN 'ate300'
          ELSE 'mais300'
        END AS band, ${statsColumns(value)}
        FROM listings l LEFT JOIN municipalities m ON m.ibge_code = l.municipality_id
        CROSS JOIN LATERAL (SELECT ${distanceKmSql(region.center)} AS km) d
        WHERE ${where} GROUP BY 1`,
    ),
    rows(
      z.object({ state: z.string(), source_id: z.string(), source_name: z.string(), ...statsShape }),
      sql`SELECT l.state AS state, s.id AS source_id, s.name AS source_name, ${statsColumns(value)}
        FROM listings l JOIN sources s ON s.id = l.source_id
        WHERE ${where} AND l.state IS NOT NULL GROUP BY 1, 2, 3`,
    ),
  ]);
  return {
    metric,
    regionLabel: region.label,
    distance: [...DISTANCE_BANDS, null].map((band) => {
      const stats = byDistance.find((row) => row.band === band);
      return { band, summary: summarize(stats && toStats(stats)) };
    }),
    places: byPlace
      .toSorted((a, b) => b.n - a.n || a.state.localeCompare(b.state) || a.source_name.localeCompare(b.source_name))
      .flatMap((row) =>
        isStateCode(row.state)
          ? [
              {
                state: row.state,
                source: { id: row.source_id, name: row.source_name },
                summary: summarize(toStats(row)),
              },
            ]
          : [],
      ),
  };
}

/** Detalhe do estado escolhido: distribuição frente à do Brasil, fontes e, se forem poucas, as vendas. */
export async function getStateDetail(filters: ResearchFilters): Promise<StateDetail | null> {
  await requireUser();
  if (filters.state === null) return null;
  return loadStateDetail(cacheKeyFilters(filters));
}

async function loadStateDetail(filters: ResearchFilters): Promise<StateDetail | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag(RESEARCH_CACHE_TAG);
  const { state } = filters;
  if (state === null) return null;
  const inState = salesWhere(filters, {});
  const [local, national, sources] = await Promise.all([
    ratioDistribution(salesWhere(filters, { ratio: true })),
    ratioDistribution(salesWhere(filters, { state: false, ratio: true })),
    rows(
      z.object({ name: z.string(), sales: z.number().int() }),
      sql`SELECT s.name AS name, count(*)::int AS sales FROM listings l JOIN sources s ON s.id = l.source_id
        WHERE ${inState} GROUP BY s.name ORDER BY 2 DESC, 1`,
    ),
  ]);
  const sales = sources.reduce((total, source) => total + source.sales, 0);
  const axisMax = ratioAxisMax(Math.max(local.max ?? 0, national.max ?? 0) || null);
  return {
    state,
    sales,
    distribution: { summary: summarize(local.stats), bins: fillHistogram(local.bins, axisMax) },
    national: { summary: summarize(national.stats), bins: fillHistogram(national.bins, axisMax) },
    axisMax,
    sources,
    few: sales > 0 && sales < MIN_SAMPLE ? await listSales(inState, MIN_SAMPLE) : [],
  };
}
