import "server-only";

import { cache } from "react";
import { z } from "zod";

import { DAMAGE_LEVELS } from "@/domain/listings/condition";
import { CATEGORY_OF_KEY } from "@/domain/listings/criteria";
import { type EstimateTarget, SALES_WINDOW_MS } from "@/domain/listings/estimates";
import { MARKET_VALUE_ORIGINS } from "@/domain/listings/fipe-match";
import { VEHICLE_ORIGINS } from "@/domain/listings/origin";
import { cents } from "@/domain/money";
import {
  DEFAULT_EVALUATE_FILTERS,
  evaluate,
  type EvaluateFilters,
  inCut,
  targetFilters,
} from "@/domain/research/evaluate";
import {
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
  weeksBetween,
} from "@/domain/research/summary";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { vehicleKeySql } from "@/server/vehicle-key-sql";

import { evaluateScopeLabel } from "./labels";
import { evaluateHref } from "./search";
import type {
  BidCurveView,
  ComparisonView,
  ConditionDistribution,
  EvaluateOpenListing,
  EvaluateSaleView,
  EvaluationView,
  LotMarketReference,
  LotTarget,
  ModelRanking,
  ModelSales,
  OriginDistribution,
  RatioDistribution,
  ResearchFacets,
  ResearchModelOption,
  ResearchOverview,
  ResearchSale,
  SaleBids,
  StateDetail,
  StateMapView,
} from "./types";

/**
 * Pesquisa (D-45): estatísticas sobre as vendas do catálogo global (D-25), agregadas no Postgres. Exige sessão, mas não
 * filtra por dono. Todo SQL é template marcado (`Prisma.sql`, parâmetros ligados) e toda linha passa por Zod.
 */

/** Vendas de um modelo devolvidas uma a uma (dispersão e tabela). */
export const MODEL_SALES_LIMIT = 500;

const sql = Prisma.sql;
const RATIO = sql`(l.final_bid_cents::float8 / l.market_value_cents)`;
const VEHICLE_KEY = vehicleKeySql(sql`l.brand`, sql`l.model`);

type SalesScope = {
  /** Filtra a categoria do filtro (a barra conta as vendas de cada categoria). */
  category?: boolean;
  /** Filtra a condição do filtro (o gráfico por condição compara todas). */
  condition?: boolean;
  /** Filtra o estado do filtro (o mapa mostra todos; o detalhe compara com o Brasil). */
  state?: boolean;
  /** Filtra a fonte do filtro (a barra conta as vendas de cada fonte). */
  source?: boolean;
  /** Filtra o km máximo do filtro (a barra diz quantas vendas têm km). */
  mileage?: boolean;
  /** Só vendas com valor de mercado e proporção dentro de `RATIO_BOUNDS`. */
  ratio?: boolean;
};

function salesSince(): Date {
  return new Date(Date.now() - SALES_WINDOW_MS);
}

/** Venda (mesmo critério da base do preço provável) dentro dos filtros pedidos. */
function salesWhere(
  filters: ResearchFilters,
  { category = true, condition = true, state = true, source = true, mileage = true, ratio = false }: SalesScope,
) {
  const parts = [sql`l.status = 'sold'`, sql`l.final_bid_cents > 0`, sql`l.ends_at >= ${salesSince()}`];
  if (category) parts.push(sql`l.category = ${CATEGORY_OF_KEY[filters.category]}`);
  if (condition) {
    const level = DAMAGE_OF_CONDITION[filters.condition];
    parts.push(level === null ? sql`l.damage_level IS NULL` : sql`l.damage_level::text = ${level}`);
  }
  if (state && filters.state !== null) parts.push(sql`l.state = ${filters.state}`);
  if (source && filters.source !== null) parts.push(sql`l.source_id = ${filters.source}`);
  if (mileage && filters.maxKm !== null) parts.push(sql`l.mileage_km <= ${filters.maxKm}`);
  if (filters.vehicle !== null) {
    parts.push(sql`${VEHICLE_KEY} = ${`${filters.vehicle.brand}|${filters.vehicle.model}`}`);
    if (filters.yearFrom !== null) parts.push(sql`l.model_year >= ${filters.yearFrom}`);
    if (filters.yearTo !== null) parts.push(sql`l.model_year <= ${filters.yearTo}`);
  }
  if (ratio) {
    parts.push(
      sql`l.market_value_cents > 0`,
      sql`${RATIO} BETWEEN ${RATIO_BOUNDS.min}::float8 AND ${RATIO_BOUNDS.max}::float8`,
    );
  }
  return Prisma.join(parts, " AND ");
}

/** Contagem e percentis (interpolação linear, a mesma de `percentile` no domínio). */
function statsColumns(value: Prisma.Sql) {
  return sql`count(*)::int AS n,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY ${value}) AS p25,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ${value}) AS median,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY ${value}) AS p75`;
}

const statsShape = { n: z.number().int(), p25: z.number(), median: z.number(), p75: z.number() };
const levelSchema = z.enum([...DAMAGE_LEVELS, "unclassified"]);

async function rows<T extends z.ZodType>(schema: T, query: Prisma.Sql): Promise<z.infer<T>[]> {
  const result = await db.$queryRaw<unknown[]>(query);
  return z.array(schema).parse(result);
}

/** Só os campos do resumo (a linha pode trazer outros, como o estado ou o máximo). */
function toStats({ n, p25, median, p75 }: GroupStats): GroupStats {
  return { n, p25, median, p75 };
}

/** Uma vez por requisição (cabeçalho e blocos usam a mesma base). */
export const getResearchOverview = cache(async (): Promise<ResearchOverview> => {
  await requireUser();
  const [row] = await rows(
    z.object({ sales: z.number().int(), fipeMatched: z.number().int(), since: z.date().nullable() }),
    sql`SELECT count(*)::int AS sales,
        count(*) FILTER (WHERE l.market_value_origin IN ('fipe_version', 'fipe_family'))::int AS "fipeMatched",
        min(l.ends_at) AS since FROM listings l
      WHERE l.status = 'sold' AND l.final_bid_cents > 0 AND l.ends_at >= ${salesSince()}`,
  );
  return row ?? { sales: 0, fipeMatched: 0, since: null };
});

/**
 * Até quantos modelos a busca conhece (os de mais vendas primeiro). Alto o bastante para a cauda longa do catálogo
 * entrar; cada modelo pesa poucos bytes na barra.
 */
const MODEL_SUGGESTIONS_LIMIT = 2000;

/**
 * Contagens da barra de filtros: vendas por condição e por categoria (cada uma com os outros filtros) e os modelos com
 * venda na categoria e condição do filtro, para a busca.
 */
export async function getResearchFacets(filters: ResearchFilters): Promise<ResearchFacets> {
  await requireUser();
  const level = sql`coalesce(l.damage_level::text, 'unclassified')`;
  const [byLevel, byCategory, byState, bySource, [mileage], byYear, models] = await Promise.all([
    rows(
      z.object({ level: levelSchema, n: z.number().int() }),
      sql`SELECT ${level} AS level, count(*)::int AS n FROM listings l
        WHERE ${salesWhere(filters, { condition: false })} GROUP BY 1`,
    ),
    rows(
      z.object({ category: z.string().nullable(), n: z.number().int() }),
      sql`SELECT l.category::text AS category, count(*)::int AS n FROM listings l
        WHERE ${salesWhere(filters, { category: false })} GROUP BY 1`,
    ),
    rows(
      z.object({ state: z.string().nullable(), n: z.number().int() }),
      sql`SELECT l.state::text AS state, count(*)::int AS n FROM listings l
        WHERE ${salesWhere(filters, { state: false })} GROUP BY 1`,
    ),
    rows(
      z.object({ id: z.string(), name: z.string(), n: z.number().int() }),
      sql`SELECT s.id, s.name, count(*)::int AS n FROM listings l JOIN sources s ON s.id = l.source_id
        WHERE ${salesWhere(filters, { source: false })} GROUP BY s.id, s.name ORDER BY 3 DESC, 2`,
    ),
    rows(
      z.object({ total: z.number().int(), known: z.number().int() }),
      sql`SELECT count(*)::int AS total, count(l.mileage_km)::int AS known FROM listings l
        WHERE ${salesWhere(filters, { mileage: false })}`,
    ),
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
  const stateCounts: Partial<Record<StateCode, number>> = {};
  for (const row of byState) if (row.state !== null && isStateCode(row.state)) stateCounts[row.state] = row.n;
  const byCondition = (condition: ResearchCondition) =>
    byLevel.find((row) => row.level === (DAMAGE_OF_CONDITION[condition] ?? "unclassified"))?.n ?? 0;
  const ofCategory = (category: ResearchCategory) =>
    byCategory.find((row) => row.category === CATEGORY_OF_KEY[category])?.n ?? 0;
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
    sources: bySource.map(({ id, name, n }) => ({ id, name, sales: n })),
    mileage: mileage ?? { total: 0, known: 0 },
    years: byYear.map(({ year, n }) => ({ year, sales: n })),
    models: models.flatMap(({ key, n }) => {
      const [brand = "", model = ""] = key.split("|");
      return brand && model ? [{ brand, model, label: vehicleLabel({ brand, model }), sales: n }] : [];
    }),
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
    sql`SELECT l.id::text AS id, l.url, l.title, l.ends_at, l.state::text AS state, l.city, l.model_year::int AS model_year,
        l.mileage_km, l.damage_level::text AS damage_level, l.final_bid_cents, l.market_value_cents,
        l.market_value_origin::text AS market_value_origin, s.name AS source, l.photo_urls[1] AS photo_url,
        (SELECT count(DISTINCT t.bid)::int FROM (
          SELECT o.bid_cents AS bid FROM listing_observations o
          WHERE o.listing_id = l.id AND o.bid_cents > 0 AND o.observed_at <= l.ends_at
            AND o.observed_at >= l.ends_at - make_interval(hours => ${SALE_BIDS_WINDOW_HOURS}::int)
          UNION SELECT l.final_bid_cents) t) AS bid_steps
      FROM listings l JOIN sources s ON s.id = l.source_id
      WHERE ${where} ORDER BY l.ends_at DESC, l.id LIMIT ${limit}`,
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
      context: { medianYear: group.median_year, medianBid: group.median_bid },
      byAge: {},
    });
  }
  for (const group of groups) {
    const model = byKey.get(group.key);
    if (group.all_ages === 1 || group.age === null || model === undefined) continue;
    model.byAge[group.age] = {
      stats: toStats(group),
      context: { medianYear: group.median_year, medianBid: group.median_bid },
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
  const yearShape = z.object({ year: z.number().int().nullable(), ...statsShape });
  const [sales, byYear, ratioByYear] = await Promise.all([
    listSales(where, MODEL_SALES_LIMIT),
    rows(
      yearShape,
      sql`SELECT l.model_year::int AS year, ${statsColumns(sql`l.final_bid_cents::float8`)} FROM listings l
        WHERE ${where} GROUP BY 1 ORDER BY 1`,
    ),
    rows(
      yearShape,
      sql`SELECT l.model_year::int AS year, ${statsColumns(RATIO)} FROM listings l
        WHERE ${salesWhere(filters, { ratio: true })} GROUP BY 1 ORDER BY 1`,
    ),
  ]);
  return {
    total: byYear.reduce((total, row) => total + row.n, 0),
    sales,
    byYear: byYear.flatMap(({ year, ...row }) => {
      if (year === null) return [];
      const ratio = ratioByYear.find((other) => other.year === year);
      return [{ year, summary: summarize(toStats(row)), ratio: summarize(ratio && toStats(ratio)) }];
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

/** Teto de vendas de um modelo no Avaliar: o maior modelo do catálogo tem perto de 2 mil no ano. */
const EVALUATE_SALES_LIMIT = 5000;

const evaluateSaleRow = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  ends_at: z.date(),
  state: z.string().nullable(),
  city: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  model_year: z.number().int().nullable(),
  mileage_km: z.number().int().nullable(),
  category: z.string().nullable(),
  damage_level: z.enum(DAMAGE_LEVELS).nullable(),
  fipe_code: z.string().nullable(),
  vehicle_origin: z.enum(VEHICLE_ORIGINS),
  final_bid_cents: z.number().int(),
  market_value_cents: z.number().int().nullable(),
  source: z.string(),
  photo_url: z.string().nullable(),
});

/**
 * Avaliar (D-71, docs/PLANO-MERCADO.md §5): as vendas do modelo base no último ano (o banco filtra o modelo, como a
 * Pesquisa) e o recorte, a faixa e as contagens calculados no domínio (`evaluate`), com o mesmo critério do preço
 * provável. Uma vez por requisição: a resposta, a lista e o gráfico usam o mesmo resultado.
 */
export const getEvaluation = cache(
  async (filters: EvaluateFilters, target: EstimateTarget | null): Promise<EvaluationView | null> => {
    await requireUser();
    if (filters.vehicle === null) return null;
    const rowsFound = await rows(
      evaluateSaleRow,
      sql`SELECT l.id::text AS id, l.url, l.title, l.ends_at, l.state::text AS state, l.city, l.brand, l.model,
          l.model_year::int AS model_year, l.mileage_km, l.category, l.damage_level::text AS damage_level,
          coalesce(l.fipe_code, l.market_value_fipe_code) AS fipe_code, l.vehicle_origin::text AS vehicle_origin,
          l.final_bid_cents, l.market_value_cents, s.name AS source, l.photo_urls[1] AS photo_url
        FROM listings l JOIN sources s ON s.id = l.source_id
        WHERE l.status = 'sold' AND l.final_bid_cents > 0 AND l.ends_at >= ${salesSince()}
          AND ${VEHICLE_KEY} = ${`${filters.vehicle.brand}|${filters.vehicle.model}`}
        ORDER BY l.ends_at DESC, l.id LIMIT ${EVALUATE_SALES_LIMIT}`,
    );
    const sales = rowsFound.map((row): EvaluateSaleView => ({
      id: row.id,
      endsAt: row.ends_at,
      url: row.url,
      title: row.title,
      state: row.state !== null && isStateCode(row.state) ? row.state : null,
      city: row.city,
      brand: row.brand,
      model: row.model,
      modelYear: row.model_year,
      mileageKm: row.mileage_km,
      category: row.category,
      damageLevel: row.damage_level,
      fipeCode: row.fipe_code,
      origin: row.vehicle_origin,
      finalBid: cents(row.final_bid_cents),
      marketValue: row.market_value_cents !== null && row.market_value_cents > 0 ? cents(row.market_value_cents) : null,
      source: row.source,
      photoUrl: row.photo_url,
    }));
    const evaluation = evaluate(sales, filters, target);
    const codes = evaluation.versions.map((option) => option.value);
    const labels =
      codes.length === 0
        ? []
        : await rows(
            z.object({ code: z.string(), name: z.string() }),
            sql`SELECT DISTINCT ON (p.fipe_code) p.fipe_code AS code, p.model_name AS name FROM fipe_prices p
              WHERE p.fipe_code IN (${Prisma.join(codes)}) ORDER BY p.fipe_code, p.reference_month DESC`,
          );
    return {
      ...evaluation,
      modelSales: sales.length,
      versionLabels: Object.fromEntries(labels.map(({ code, name }) => [code, name])),
    };
  },
);

/**
 * Lote do usuário como alvo do Avaliar: veículo do lote e, com anúncio ligado, categoria, condição, versão FIPE,
 * origem e valor de mercado. Lote de outro dono é `null`.
 */
export const getLotTarget = cache(async (lotId: string): Promise<LotTarget | null> => {
  const user = await requireUser();
  const lot = await db.lot.findFirst({
    where: { id: lotId, ownerId: user.id },
    select: {
      id: true,
      lotNumber: true,
      brand: true,
      model: true,
      modelYear: true,
      mileageKm: true,
      listing: {
        select: {
          mileageKm: true,
          category: true,
          damageLevel: true,
          fipeCode: true,
          marketValueFipeCode: true,
          vehicleOrigin: true,
          marketValueCents: true,
          status: true,
          endsAt: true,
        },
      },
    },
  });
  if (lot === null) return null;
  const { listing } = lot;
  return {
    id: lot.id,
    label: `Lote ${lot.lotNumber} · ${lot.brand} ${lot.model} ${lot.modelYear}`,
    endsAt: listing?.status === "open" ? listing.endsAt : null,
    target: {
      brand: lot.brand,
      model: lot.model,
      modelYear: lot.modelYear,
      mileageKm: lot.mileageKm ?? listing?.mileageKm ?? null,
      category: listing?.category ?? null,
      damageLevel: listing?.damageLevel ?? null,
      fipeCode: listing === null ? null : (listing.fipeCode ?? listing.marketValueFipeCode),
      origin: listing?.vehicleOrigin ?? null,
      marketValue:
        listing?.marketValueCents === null || listing?.marketValueCents === undefined
          ? null
          : cents(listing.marketValueCents),
    },
  };
});

/**
 * Mercado do lote para a análise (bloco Concorrência e snapshot da fixação, docs/PLANO-MERCADO.md §8): o mesmo recorte
 * do preço provável e do painel da ficha. Lote de outro dono ou sem marca e modelo é `null`.
 */
export const getLotMarketReference = cache(async (lotId: string): Promise<LotMarketReference | null> => {
  const lot = await getLotTarget(lotId);
  if (lot === null) return null;
  const filters = targetFilters(lot.target, lot.id, []);
  const evaluation = await getEvaluation(filters, lot.target);
  if (evaluation === null) return null;
  const { answer } = evaluation;
  return {
    level: evaluation.level,
    scope: evaluateScopeLabel(filters, evaluation.versionLabels),
    href: evaluateHref({ ...DEFAULT_EVALUATE_FILTERS, lot: lot.id }),
    sales: evaluation.comparables.flatMap(({ sale, excluded }) =>
      excluded ? [] : [{ id: sale.id, finalBid: sale.finalBid }],
    ),
    band:
      answer.kind === "band"
        ? { low: answer.low, median: answer.median, high: answer.high, confidence: answer.confidence }
        : null,
  };
});

/** Teto de lotes abertos de um modelo no Avaliar. */
const OPEN_LISTINGS_LIMIT = 200;

const openListingRow = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  ends_at: z.date().nullable(),
  state: z.string().nullable(),
  city: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  model_year: z.number().int().nullable(),
  mileage_km: z.number().int().nullable(),
  category: z.string().nullable(),
  damage_level: z.enum(DAMAGE_LEVELS).nullable(),
  fipe_code: z.string().nullable(),
  vehicle_origin: z.enum(VEHICLE_ORIGINS),
  current_bid_cents: z.number().int().nullable(),
  source: z.string(),
  photo_url: z.string().nullable(),
});

/**
 * Lotes abertos do recorte do Avaliar (mesmo modelo base no banco, o resto do recorte no domínio com `inCut`), do que
 * encerra primeiro ao último, com o lote do usuário quando o anúncio já foi analisado.
 */
export const getOpenListingsFor = cache(async (filters: EvaluateFilters): Promise<EvaluateOpenListing[]> => {
  const user = await requireUser();
  if (filters.vehicle === null) return [];
  const found = await rows(
    openListingRow,
    sql`SELECT l.id::text AS id, l.url, l.title, l.ends_at, l.state::text AS state, l.city, l.brand, l.model,
        l.model_year::int AS model_year, l.mileage_km, l.category, l.damage_level::text AS damage_level,
        coalesce(l.fipe_code, l.market_value_fipe_code) AS fipe_code, l.vehicle_origin::text AS vehicle_origin,
        l.current_bid_cents, s.name AS source, l.photo_urls[1] AS photo_url
      FROM listings l JOIN sources s ON s.id = l.source_id
      WHERE l.status = 'open' AND (l.ends_at IS NULL OR l.ends_at > now())
        AND ${VEHICLE_KEY} = ${`${filters.vehicle.brand}|${filters.vehicle.model}`}
      ORDER BY l.ends_at ASC NULLS LAST, l.id LIMIT ${OPEN_LISTINGS_LIMIT}`,
  );
  const inRecort = found.filter((row) =>
    inCut(
      {
        brand: row.brand,
        model: row.model,
        modelYear: row.model_year,
        mileageKm: row.mileage_km,
        category: row.category,
        damageLevel: row.damage_level,
        fipeCode: row.fipe_code,
        origin: row.vehicle_origin,
      },
      filters,
    ),
  );
  const lots =
    inRecort.length === 0
      ? []
      : await db.lot.findMany({
          where: { ownerId: user.id, listingId: { in: inRecort.map((row) => row.id) } },
          select: { id: true, listingId: true },
        });
  const lotOf = new Map(lots.map((lot) => [lot.listingId, lot.id]));
  return inRecort.map((row) => ({
    id: row.id,
    url: row.url,
    title: row.title,
    modelYear: row.model_year,
    mileageKm: row.mileage_km,
    endsAt: row.ends_at,
    currentBid: row.current_bid_cents === null ? null : cents(row.current_bid_cents),
    state: row.state !== null && isStateCode(row.state) ? row.state : null,
    city: row.city,
    source: row.source,
    photoUrl: row.photo_url,
    trackedLotId: lotOf.get(row.id) ?? null,
    trackable: row.brand !== null && row.model !== null && row.model_year !== null,
  }));
});

/** Modelos com venda no último ano, de qualquer categoria e condição, para a busca do Avaliar. */
export const getEvaluateModels = cache(async (): Promise<ResearchModelOption[]> => {
  await requireUser();
  const models = await rows(
    z.object({ key: z.string(), n: z.number().int() }),
    sql`SELECT t.key, count(*)::int AS n
      FROM (SELECT ${VEHICLE_KEY} AS key FROM listings l
        WHERE l.status = 'sold' AND l.final_bid_cents > 0 AND l.ends_at >= ${salesSince()}) t
      WHERE t.key IS NOT NULL GROUP BY t.key ORDER BY 2 DESC, 1 LIMIT ${MODEL_SUGGESTIONS_LIMIT}`,
  );
  return models.flatMap(({ key, n }) => {
    const [brand = "", model = ""] = key.split("|");
    return brand && model ? [{ brand, model, label: vehicleLabel({ brand, model }), sales: n }] : [];
  });
});

/** Quantos lotes o Avaliar oferece como atalho sem veículo escolhido. */
const LOT_SHORTCUTS = 6;

/**
 * Atalhos da entrada do Avaliar: os lotes do usuário que ainda não foram arquivados, os acompanhados primeiro e depois
 * os mexidos por último. Cada um abre o Avaliar com o lote como alvo.
 */
export async function getEvaluateLotShortcuts(): Promise<{ id: string; label: string }[]> {
  const user = await requireUser();
  const lots = await db.lot.findMany({
    where: { ownerId: user.id, archivedAt: null },
    orderBy: [{ isFollowed: "desc" }, { updatedAt: "desc" }],
    take: LOT_SHORTCUTS,
    select: { id: true, lotNumber: true, brand: true, model: true, modelYear: true },
  });
  return lots.map((lot) => ({
    id: lot.id,
    label: `${lot.brand} ${lot.model} ${lot.modelYear} · lote ${lot.lotNumber}`,
  }));
}
