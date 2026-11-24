import "server-only";

import { cache } from "react";
import { z } from "zod";

import { cents } from "@/domain/money";
import { type ResearchFilters } from "@/domain/research/filters";
import {
  AGE_BAND_LIMITS,
  AGE_BANDS,
  MIN_SAMPLE,
  type ModelStats,
  rankModels,
  RATIO_BOUNDS,
  summarize,
  weeksBetween,
} from "@/domain/research/summary";
import { requireUser } from "@/server/auth";

import type { ModelRanking, ModelSales } from "../types";
import { listSales } from "./shared";
import { MODEL_SALES_LIMIT, RATIO, rows, salesWhere, sql, statsColumns, statsShape, toStats, VEHICLE_KEY } from "./sql";

const rankingRow = z.object({
  key: z.string(),
  age: z.enum(AGE_BANDS).nullable(),
  all_ages: z.number().int(),
  median_year: z.number().nullable(),
  median_bid: z.number(),
  ...statsShape,
});

/**
 * Ranking dos modelos (D-45, docs/PLANO-MERCADO.md §6): por modelo, o resumo do % da FIPE com o ano-modelo e o lance
 * final medianos, para todas as idades e por faixa de idade na venda (`GROUPING SETS`, uma consulta só), mais as
 * semanas cobertas pelas vendas do filtro, para "vendas por semana". Só grupos com a amostra mínima.
 */
export async function getModelRanking(filters: ResearchFilters): Promise<ModelRanking> {
  await requireUser();
  const where = salesWhere({ ...filters, vehicle: null }, { ratio: true });
  const [groups, [span]] = await Promise.all([
    rows(
      rankingRow,
      sql`WITH t AS (
          SELECT ${VEHICLE_KEY} AS key, ${RATIO} AS ratio, l.model_year AS year, l.final_bid_cents::float8 AS bid,
            CASE
              WHEN l.model_year IS NULL THEN NULL
              WHEN extract(year FROM l.ends_at)::int - l.model_year <= ${AGE_BAND_LIMITS.ate5}::int THEN 'ate5'
              WHEN extract(year FROM l.ends_at)::int - l.model_year <= ${AGE_BAND_LIMITS["6a10"]}::int THEN '6a10'
              ELSE 'mais10'
            END AS age
          FROM listings l WHERE ${where}
        )
        SELECT t.key, t.age, GROUPING(t.age)::int AS all_ages, ${statsColumns(sql`t.ratio`)},
          percentile_disc(0.5) WITHIN GROUP (ORDER BY t.year)::float8 AS median_year,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY t.bid) AS median_bid
        FROM t WHERE t.key IS NOT NULL
        GROUP BY GROUPING SETS ((t.key), (t.key, t.age))
        HAVING count(*) >= ${MIN_SAMPLE}`,
    ),
    rows(
      z.object({ first: z.date().nullable(), last: z.date().nullable() }),
      sql`SELECT min(l.ends_at) AS first, max(l.ends_at) AS last FROM listings l WHERE ${where}`,
    ),
  ]);
  const byKey = new Map<string, ModelStats>();
  // Primeiro as linhas de todas as idades (`GROUPING` = 1), depois as faixas de cada modelo.
  for (const group of groups.filter((row) => row.all_ages === 1)) {
    const [brand = "", model = ""] = group.key.split("|");
    byKey.set(group.key, {
      brand,
      model,
      stats: toStats(group),
      context: { medianYear: group.median_year, medianBid: cents(Math.round(group.median_bid)) },
      byAge: {},
    });
  }
  for (const group of groups) {
    const model = byKey.get(group.key);
    if (group.all_ages === 1 || group.age === null || model === undefined) continue;
    model.byAge[group.age] = {
      stats: toStats(group),
      context: { medianYear: group.median_year, medianBid: cents(Math.round(group.median_bid)) },
    };
  }
  return {
    models: rankModels([...byKey.values()]),
    weeks: span?.first && span.last ? weeksBetween(span.first, span.last) : 1,
  };
}

/** Vendas do modelo escolhido: as mais recentes uma a uma e o lance final por ano-modelo. */
export const getModelSales = cache(async (filters: ResearchFilters): Promise<ModelSales | null> => {
  await requireUser();
  if (filters.vehicle === null) return null;
  const where = salesWhere(filters, {});
  const ratioSafe = sql`(l.final_bid_cents::float8 / NULLIF(l.market_value_cents, 0))`;
  const ratioValid = sql`l.market_value_cents > 0 AND ${ratioSafe} BETWEEN ${RATIO_BOUNDS.min}::float8 AND ${RATIO_BOUNDS.max}::float8`;
  const yearRow = z.object({
    year: z.number().int().nullable(),
    ...statsShape,
    ratio_n: z.number().int(),
    ratio_p25: z.number().nullable(),
    ratio_median: z.number().nullable(),
    ratio_p75: z.number().nullable(),
  });
  const [sales, byYear] = await Promise.all([
    listSales(where, MODEL_SALES_LIMIT),
    rows(
      yearRow,
      sql`SELECT l.model_year::int AS year, ${statsColumns(sql`l.final_bid_cents::float8`)},
          count(*) FILTER (WHERE ${ratioValid})::int AS ratio_n,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY ${ratioSafe}) FILTER (WHERE ${ratioValid}) AS ratio_p25,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY ${ratioSafe}) FILTER (WHERE ${ratioValid}) AS ratio_median,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY ${ratioSafe}) FILTER (WHERE ${ratioValid}) AS ratio_p75
        FROM listings l WHERE ${where} GROUP BY 1 ORDER BY 1`,
    ),
  ]);
  return {
    total: byYear.reduce((total, row) => total + row.n, 0),
    sales,
    byYear: byYear.flatMap(({ year, ratio_n, ratio_p25, ratio_median, ratio_p75, ...row }) => {
      if (year === null) return [];
      const ratioStats =
        ratio_n > 0 && ratio_p25 !== null && ratio_median !== null && ratio_p75 !== null
          ? { n: ratio_n, p25: ratio_p25, median: ratio_median, p75: ratio_p75 }
          : undefined;
      return [{ year, summary: summarize(toStats(row)), ratio: summarize(ratioStats) }];
    }),
  };
});
