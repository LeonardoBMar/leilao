import "server-only";

import { cacheLife } from "next/cache";
import { cache } from "react";
import { z } from "zod";

import { DAMAGE_LEVELS } from "@/domain/listings/condition";
import { CATEGORY_OF_KEY } from "@/domain/listings/criteria";
import { MARKET_VALUE_ORIGINS } from "@/domain/listings/fipe-match";
import { VEHICLE_ORIGINS } from "@/domain/listings/origin";
import { cents } from "@/domain/money";
import {
  availablePeriods,
  comparisonGroups,
  DAMAGE_OF_CONDITION,
  effectiveMetric,
  groupLabel,
  RESEARCH_CONDITIONS,
  type ResearchCategory,
  type ResearchCondition,
  type ResearchFilters,
  vehicleLabel,
} from "@/domain/research/filters";
import { SALE_BIDS_WINDOW_HOURS, saleBidSteps } from "@/domain/research/sale-bids";
import { buildStateSummaries, isStateCode, type StateCode } from "@/domain/research/states";
import {
  AGE_BAND_LIMITS,
  AGE_BANDS,
  BID_CURVE_HOURS,
  BID_CURVE_LOOKBACK_HOURS,
  bidCurve,
  DISTANCE_BAND_LIMITS,
  DISTANCE_BANDS,
  type ExcludedSales,
  fillHistogram,
  type GroupStats,
  type GroupSummary,
  HISTOGRAM_STEP,
  isRatioInBounds,
  MIN_SAMPLE,
  type ModelStats,
  rankModels,
  RATIO_BOUNDS,
  ratioAxisMax,
  summarize,
  unclassifiedLooksMixed,
  weeklyTrend,
  weeksBetween,
} from "@/domain/research/summary";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { catalogSources } from "@/server/catalog-values";
import { db } from "@/server/db";

import type {
  BidCurveView,
  ComparisonView,
  ConditionDistribution,
  ModelRanking,
  ModelSales,
  OriginDistribution,
  RatioDistribution,
  ResearchFacets,
  ResearchOverview,
  ResearchSale,
  SaleBids,
  StateDetail,
  StateMapView,
  WeeklyTrend,
  WhereView,
} from "../types";
import {
  DISTANCE_KM,
  levelSchema,
  MODEL_SALES_LIMIT,
  MODEL_SUGGESTIONS_LIMIT,
  RATIO,
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
  const level = sql`coalesce(l.damage_level::text, 'unclassified')`;
  const withinKm = filters.maxKm === null ? sql`true` : sql`coalesce(l.mileage_km <= ${filters.maxKm}, false)`;
  const [{ since }, facetRows, sourceRows, byYear, models] = await Promise.all([
    getResearchOverview(),
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

/** Resumo e histograma do % do valor de mercado num recorte, mais a maior proporção (fim do eixo). */
async function ratioDistribution(
  where: Prisma.Sql,
): Promise<{ stats: GroupStats | null; bins: { bin: number; n: number }[]; max: number | null }> {
  const [statsRows, bins] = await Promise.all([
    rows(
      z.object({ ...statsShape, max: z.number().nullable() }),
      sql`SELECT ${statsColumns(RATIO)}, max(${RATIO}) AS max FROM listings l WHERE ${where} HAVING count(*) > 0`,
    ),
    rows(
      z.object({ bin: z.number().int(), n: z.number().int() }),
      sql`SELECT floor(${RATIO} / ${HISTOGRAM_STEP}::float8 + 1e-9)::int AS bin, count(*)::int AS n
        FROM listings l WHERE ${where} GROUP BY 1`,
    ),
  ]);
  const [stats] = statsRows;
  return { stats: stats ? toStats(stats) : null, bins, max: stats?.max ?? null };
}

/**
 * Resumo e histograma do % da FIPE de cada grupo de um recorte, num eixo comum (o fim vem da maior proporção). `group`
 * é a expressão SQL do grupo, validada por `key`; grupo sem venda volta como `summarize(undefined)` e histograma vazio.
 */
async function groupedDistribution<K extends string>(
  key: z.ZodType<K>,
  group: Prisma.Sql,
  where: Prisma.Sql,
): Promise<{ axisMax: number; of: (value: K) => RatioDistribution }> {
  const [statsRows, binRows] = await Promise.all([
    rows(
      z.object({ key, ...statsShape, max: z.number() }),
      sql`SELECT ${group} AS key, ${statsColumns(RATIO)}, max(${RATIO}) AS max FROM listings l WHERE ${where} GROUP BY 1`,
    ),
    rows(
      z.object({ key, bin: z.number().int(), n: z.number().int() }),
      sql`SELECT ${group} AS key, floor(${RATIO} / ${HISTOGRAM_STEP}::float8 + 1e-9)::int AS bin, count(*)::int AS n
        FROM listings l WHERE ${where} GROUP BY 1, 2`,
    ),
  ]);
  const axisMax = ratioAxisMax(statsRows.length === 0 ? null : Math.max(...statsRows.map((row) => row.max)));
  return {
    axisMax,
    of: (value) => {
      const stats = statsRows.find((row) => row.key === value);
      const bins = binRows.filter((row) => row.key === value);
      return { summary: summarize(stats && toStats(stats)), bins: fillHistogram(bins, axisMax) };
    },
  };
}

/** "Quanto se paga por condição": todas as condições, com o resto dos filtros (D-45). */
export const getConditionDistribution = cache(async (filters: ResearchFilters): Promise<ConditionDistribution> => {
  await requireUser();
  const { axisMax, of } = await groupedDistribution(
    levelSchema,
    sql`coalesce(l.damage_level::text, 'unclassified')`,
    salesWhere(filters, { condition: false, ratio: true }),
  );
  const conditionRows = RESEARCH_CONDITIONS.map((condition) => ({
    condition,
    ...of(DAMAGE_OF_CONDITION[condition] ?? "unclassified"),
  }));
  return {
    rows: conditionRows,
    axisMax,
    looksMixed: unclassifiedLooksMixed(Object.fromEntries(conditionRows.map((row) => [row.condition, row.summary]))),
  };
});

/**
 * "De quem se compra" (docs/PLANO-MERCADO.md §6): o % da FIPE por origem inferida do veículo (D-73), com todos os
 * filtros, inclusive a condição: banco e seguradora vendem carros diferentes, e a condição não pode se misturar.
 */
export const getOriginDistribution = cache(async (filters: ResearchFilters): Promise<OriginDistribution> => {
  await requireUser();
  const { axisMax, of } = await groupedDistribution(
    z.enum(VEHICLE_ORIGINS),
    sql`l.vehicle_origin::text`,
    salesWhere(filters, { ratio: true }),
  );
  return { rows: VEHICLE_ORIGINS.map((origin) => ({ origin, ...of(origin) })), axisMax };
});

/** Vendas do filtro que ficam fora dos gráficos em %, por motivo. */
export const getExcludedSales = cache(async (filters: ResearchFilters): Promise<ExcludedSales> => {
  await requireUser();
  const [row] = await rows(
    z.object({ noMarketValue: z.number().int(), outOfBounds: z.number().int() }),
    sql`SELECT count(*) FILTER (WHERE coalesce(l.market_value_cents, 0) <= 0)::int AS "noMarketValue",
        count(*) FILTER (WHERE l.market_value_cents > 0
          AND ${RATIO} NOT BETWEEN ${RATIO_BOUNDS.min}::float8 AND ${RATIO_BOUNDS.max}::float8)::int AS "outOfBounds"
      FROM listings l WHERE ${salesWhere(filters, {})}`,
  );
  return row ?? { noMarketValue: 0, outOfBounds: 0 };
});

/** Mapa: um resumo por estado, em % do valor de mercado ou, com modelo, em lance final (centavos). */
export async function getStateMap(filters: ResearchFilters): Promise<StateMapView> {
  await requireUser();
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
 * Tendência (D-75): o resumo do % da FIPE por semana (segunda a domingo, UTC) com todos os filtros; só aparece com
 * semanas de base o bastante (`weeklyTrend`).
 */
export const getWeeklyTrend = cache(async (filters: ResearchFilters): Promise<WeeklyTrend> => {
  await requireUser();
  const byWeek = await rows(
    z.object({ week: z.date(), ...statsShape }),
    sql`SELECT date_trunc('week', l.ends_at AT TIME ZONE 'UTC') AS week, ${statsColumns(RATIO)}
      FROM listings l WHERE ${salesWhere(filters, { ratio: true })} GROUP BY 1 ORDER BY 1`,
  );
  const weeks = weeklyTrend(byWeek.map((row) => ({ start: row.week, stats: toStats(row) })));
  return {
    weeks:
      weeks?.flatMap(({ start, stats }) => {
        const summary = summarize(stats);
        return summary.kind === "summary" ? [{ start, summary }] : [];
      }) ?? null,
  };
});

/**
 * "Onde" (docs/PLANO-MERCADO.md §6): o resumo por faixa de distância da região padrão e por estado e fonte, com todos
 * os filtros e na medida do mapa (% da FIPE ou, com modelo, lance final).
 */
export const getWhereView = cache(async (filters: ResearchFilters): Promise<WhereView> => {
  await requireUser();
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
        CROSS JOIN LATERAL (SELECT ${DISTANCE_KM} AS km) d
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
});

const saleRow = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  ends_at: z.date(),
  state: z.string().nullable(),
  city: z.string().nullable(),
  model_year: z.number().int().nullable(),
  mileage_km: z.number().int().nullable(),
  damage_level: z.enum(DAMAGE_LEVELS).nullable(),
  final_bid_cents: z.number().int(),
  market_value_cents: z.number().int().nullable(),
  market_value_origin: z.enum(MARKET_VALUE_ORIGINS).nullable(),
  source: z.string(),
  photo_url: z.string().nullable(),
  bid_steps: z.number().int(),
});

function toSale(row: z.infer<typeof saleRow>): ResearchSale {
  const marketValue = row.market_value_cents !== null && row.market_value_cents > 0 ? row.market_value_cents : null;
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    endsAt: row.ends_at,
    state: row.state !== null && isStateCode(row.state) ? row.state : null,
    city: row.city,
    modelYear: row.model_year,
    mileageKm: row.mileage_km,
    damageLevel: row.damage_level,
    finalBid: cents(row.final_bid_cents),
    marketValue: marketValue === null ? null : cents(marketValue),
    marketValueOrigin: marketValue === null ? null : row.market_value_origin,
    ratio: marketValue === null ? null : row.final_bid_cents / marketValue,
    ratioInBounds: marketValue !== null && isRatioInBounds(row.final_bid_cents / marketValue),
    source: row.source,
    photoUrl: row.photo_url,
    bidSteps: row.bid_steps,
  };
}

/** Vendas uma a uma, das mais recentes. */
async function listSales(where: Prisma.Sql, limit: number): Promise<ResearchSale[]> {
  const sales = await rows(
    saleRow,
    sql`WITH top_sales AS (
        SELECT l.id, l.url, l.title, l.ends_at, l.state, l.city, l.model_year,
          l.mileage_km, l.damage_level, l.final_bid_cents, l.market_value_cents,
          l.market_value_origin, s.name AS source, l.photo_urls[1] AS photo_url
        FROM listings l JOIN sources s ON s.id = l.source_id
        WHERE ${where} ORDER BY l.ends_at DESC, l.id LIMIT ${limit}
      ), steps AS (
        SELECT bids.listing_id, count(DISTINCT bids.bid)::int AS bid_steps
        FROM (
          SELECT t.id AS listing_id, o.bid_cents AS bid
          FROM top_sales t JOIN listing_observations o ON o.listing_id = t.id
          WHERE o.bid_cents > 0 AND o.observed_at <= t.ends_at
            AND o.observed_at >= t.ends_at - make_interval(hours => ${SALE_BIDS_WINDOW_HOURS}::int)
          UNION ALL
          SELECT t.id AS listing_id, t.final_bid_cents AS bid FROM top_sales t
        ) bids
        GROUP BY bids.listing_id
      )
      SELECT t.id::text AS id, t.url, t.title, t.ends_at, t.state::text AS state, t.city, t.model_year::int AS model_year,
        t.mileage_km, t.damage_level::text AS damage_level, t.final_bid_cents, t.market_value_cents,
        t.market_value_origin::text AS market_value_origin, t.source, t.photo_url,
        coalesce(st.bid_steps, 1)::int AS bid_steps
      FROM top_sales t LEFT JOIN steps st ON st.listing_id = t.id
      ORDER BY t.ends_at DESC, t.id`,
  );
  return sales.map(toSale);
}

/** Detalhe do estado escolhido: distribuição frente à do Brasil, fontes e, se forem poucas, as vendas. */
export async function getStateDetail(filters: ResearchFilters): Promise<StateDetail | null> {
  await requireUser();
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

/**
 * "Comparação": a distribuição do % do valor de mercado dos dois grupos (o dos filtros e o que a comparação troca), com
 * o resto dos filtros iguais e o mesmo fim de eixo. `null` sem comparação.
 */
export const getComparison = cache(async (filters: ResearchFilters): Promise<ComparisonView | null> => {
  await requireUser();
  const groups = comparisonGroups(filters);
  if (groups === null) return null;
  const parts = await Promise.all(groups.map((group) => ratioDistribution(salesWhere(group, { ratio: true }))));
  const axisMax = ratioAxisMax(Math.max(0, ...parts.map((part) => part.max ?? 0)) || null);
  return {
    axisMax,
    groups: groups.map((group, index) => ({
      label: groupLabel(group),
      distribution: {
        summary: summarize(parts[index]?.stats),
        bins: fillHistogram(parts[index]?.bins ?? [], axisMax),
      },
    })),
  };
});

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

/** Lance final (centavos) de todas as vendas do filtro, para a leitura de um modelo em R$. */
export const getPriceSummary = cache(async (filters: ResearchFilters): Promise<GroupSummary> => {
  await requireUser();
  const [row] = await rows(
    z.object(statsShape),
    sql`SELECT ${statsColumns(sql`l.final_bid_cents::float8`)} FROM listings l
      WHERE ${salesWhere(filters, {})} HAVING count(*) > 0`,
  );
  return summarize(row && toStats(row));
});

/**
 * Lances de uma venda do catálogo nas horas antes do fim, em degraus (só o que o coletor viu). `null` se o id não é de
 * uma venda.
 */
export const getSaleBids = cache(async (saleId: string): Promise<SaleBids | null> => {
  await requireUser();
  const sale = await db.listing.findFirst({
    // Mesma base dos outros blocos: venda com lance final na janela das estimativas.
    where: { id: saleId, status: "sold", finalBidCents: { gt: 0 }, endsAt: { gte: salesSince() } },
    select: {
      id: true,
      title: true,
      url: true,
      endsAt: true,
      finalBidCents: true,
      marketValueCents: true,
      observations: {
        where: { bidCents: { gt: 0 } },
        orderBy: { observedAt: "asc" },
        select: { observedAt: true, bidCents: true },
      },
    },
  });
  if (sale === null || sale.endsAt === null || sale.finalBidCents === null) return null;
  const marketValue = sale.marketValueCents !== null && sale.marketValueCents > 0 ? cents(sale.marketValueCents) : null;
  return {
    id: sale.id,
    title: sale.title,
    url: sale.url,
    endsAt: sale.endsAt,
    finalBid: cents(sale.finalBidCents),
    marketValue,
    steps: saleBidSteps(
      sale.observations.flatMap(({ observedAt, bidCents }) =>
        bidCents === null ? [] : [{ observedAt, bid: cents(bidCents) }],
      ),
      sale.endsAt,
      cents(sale.finalBidCents),
    ),
  };
});

/**
 * "Como o lance sobe": para cada venda e marca (horas antes do fim), a última observação com lance nas
 * `BID_CURVE_LOOKBACK_HOURS` anteriores à marca, como proporção do lance final.
 */
export const getBidCurve = cache(async (filters: ResearchFilters): Promise<BidCurveView> => {
  await requireUser();
  const marks = Prisma.join(BID_CURVE_HOURS.map((hours) => sql`(${hours}::int)`));
  const marksRows = await rows(
    z.object({ hours: z.number().int(), ...statsShape }),
    sql`WITH s AS (
        SELECT l.id, l.ends_at, l.final_bid_cents FROM listings l WHERE ${salesWhere(filters, {})} AND l.ends_at IS NOT NULL
      ), observed AS (
        SELECT DISTINCT ON (s.id, m.hours) m.hours, o.bid_cents::float8 / s.final_bid_cents AS ratio
        FROM s CROSS JOIN (VALUES ${marks}) AS m(hours)
        JOIN listing_observations o ON o.listing_id = s.id
          AND o.bid_cents > 0
          AND o.observed_at <= s.ends_at - make_interval(hours => m.hours)
          AND o.observed_at > s.ends_at - make_interval(hours => m.hours + ${BID_CURVE_LOOKBACK_HOURS}::int)
        ORDER BY s.id, m.hours, o.observed_at DESC
      )
      SELECT hours, ${statsColumns(sql`ratio`)} FROM observed GROUP BY hours`,
  );
  return {
    points: bidCurve(
      marksRows.flatMap((row) => {
        const hours = BID_CURVE_HOURS.find((mark) => mark === row.hours);
        return hours === undefined ? [] : [{ hours, stats: toStats(row) }];
      }),
    ),
  };
});
