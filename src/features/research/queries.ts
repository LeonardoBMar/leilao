import "server-only";

import { z } from "zod";

import { DAMAGE_LEVELS } from "@/domain/listings/condition";
import { CATEGORY_OF_KEY } from "@/domain/listings/criteria";
import { SALES_WINDOW_MS } from "@/domain/listings/estimates";
import { cents } from "@/domain/money";
import {
  DAMAGE_OF_CONDITION,
  effectiveMetric,
  RESEARCH_CONDITIONS,
  type ResearchFilters,
} from "@/domain/research/filters";
import {
  BID_CURVE_HOURS,
  BID_CURVE_LOOKBACK_HOURS,
  bidCurve,
  fillHistogram,
  type GroupStats,
  HISTOGRAM_STEP,
  MIN_SAMPLE,
  rankModels,
  RATIO_BOUNDS,
  ratioAxisMax,
  summarize,
  unclassifiedLooksMixed,
} from "@/domain/research/summary";
import { buildTiles, isStateCode, type StateCode } from "@/domain/research/tile-map";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { vehicleKeySql } from "@/server/vehicle-key-sql";

import type {
  BidCurveView,
  ConditionDistribution,
  ModelRanking,
  ModelSales,
  ResearchOverview,
  ResearchSale,
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
  /** Filtra a condição do filtro (o gráfico por condição compara todas). */
  condition?: boolean;
  /** Filtra o estado do filtro (o mapa mostra todos; o detalhe compara com o Brasil). */
  state?: boolean;
  /** Só vendas com valor de mercado e proporção dentro de `RATIO_BOUNDS`. */
  ratio?: boolean;
};

function salesSince(): Date {
  return new Date(Date.now() - SALES_WINDOW_MS);
}

/** Venda (mesmo critério da base do preço provável) dentro dos filtros pedidos. */
function salesWhere(filters: ResearchFilters, { condition = true, state = true, ratio = false }: SalesScope) {
  const parts = [
    sql`l.status = 'sold'`,
    sql`l.final_bid_cents > 0`,
    sql`l.ends_at >= ${salesSince()}`,
    sql`l.category = ${CATEGORY_OF_KEY[filters.category]}`,
  ];
  if (condition) {
    const level = DAMAGE_OF_CONDITION[filters.condition];
    parts.push(level === null ? sql`l.damage_level IS NULL` : sql`l.damage_level::text = ${level}`);
  }
  if (state && filters.state !== null) parts.push(sql`l.state = ${filters.state}`);
  if (filters.vehicle !== null)
    parts.push(sql`${VEHICLE_KEY} = ${`${filters.vehicle.brand}|${filters.vehicle.model}`}`);
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

export async function getResearchOverview(): Promise<ResearchOverview> {
  await requireUser();
  const [row] = await rows(
    z.object({ sales: z.number().int(), since: z.date().nullable() }),
    sql`SELECT count(*)::int AS sales, min(l.ends_at) AS since FROM listings l
      WHERE l.status = 'sold' AND l.final_bid_cents > 0 AND l.ends_at >= ${salesSince()}`,
  );
  return row ?? { sales: 0, since: null };
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

/** "Quanto se paga por condição": todas as condições, com o resto dos filtros (D-45). */
export async function getConditionDistribution(filters: ResearchFilters): Promise<ConditionDistribution> {
  await requireUser();
  const where = salesWhere(filters, { condition: false, ratio: true });
  const level = sql`coalesce(l.damage_level::text, 'unclassified')`;
  const [statsRows, binRows] = await Promise.all([
    rows(
      z.object({ level: levelSchema, ...statsShape, max: z.number() }),
      sql`SELECT ${level} AS level, ${statsColumns(RATIO)}, max(${RATIO}) AS max FROM listings l WHERE ${where} GROUP BY 1`,
    ),
    rows(
      z.object({ level: levelSchema, bin: z.number().int(), n: z.number().int() }),
      sql`SELECT ${level} AS level, floor(${RATIO} / ${HISTOGRAM_STEP}::float8 + 1e-9)::int AS bin, count(*)::int AS n
        FROM listings l WHERE ${where} GROUP BY 1, 2`,
    ),
  ]);
  const levelOf = (condition: (typeof RESEARCH_CONDITIONS)[number]) => DAMAGE_OF_CONDITION[condition] ?? "unclassified";
  const axisMax = ratioAxisMax(statsRows.length === 0 ? null : Math.max(...statsRows.map((row) => row.max)));
  const conditionRows = RESEARCH_CONDITIONS.map((condition) => {
    const stats = statsRows.find((row) => row.level === levelOf(condition));
    const bins = binRows.filter((row) => row.level === levelOf(condition));
    return { condition, summary: summarize(stats && toStats(stats)), bins: fillHistogram(bins, axisMax) };
  });
  return {
    rows: conditionRows,
    axisMax,
    looksMixed: unclassifiedLooksMixed(Object.fromEntries(conditionRows.map((row) => [row.condition, row.summary]))),
  };
}

/** Mapa de quadrados: um resumo por estado, em % do valor de mercado ou, com modelo, em lance final (centavos). */
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
  return { metric, tiles: buildTiles(stats) };
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
  source: z.string(),
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
    ratio: marketValue === null ? null : row.final_bid_cents / marketValue,
    source: row.source,
  };
}

/** Vendas uma a uma, das mais recentes. */
async function listSales(where: Prisma.Sql, limit: number): Promise<ResearchSale[]> {
  const sales = await rows(
    saleRow,
    sql`SELECT l.id::text AS id, l.url, l.title, l.ends_at, l.state::text AS state, l.city, l.model_year::int AS model_year,
        l.mileage_km, l.damage_level::text AS damage_level, l.final_bid_cents, l.market_value_cents, s.name AS source
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

/** "Modelos que mais saem abaixo do valor de mercado": só com a amostra mínima (D-45). */
export async function getModelRanking(filters: ResearchFilters): Promise<ModelRanking> {
  await requireUser();
  const groups = await rows(
    z.object({ key: z.string(), ...statsShape }),
    sql`SELECT t.key, ${statsColumns(sql`t.ratio`)}
      FROM (SELECT ${VEHICLE_KEY} AS key, ${RATIO} AS ratio FROM listings l
        WHERE ${salesWhere({ ...filters, vehicle: null }, { ratio: true })}) t
      WHERE t.key IS NOT NULL GROUP BY t.key HAVING count(*) >= ${MIN_SAMPLE}`,
  );
  return rankModels(
    groups.map((group) => {
      const [brand = "", model = ""] = group.key.split("|");
      return { brand, model, stats: toStats(group) };
    }),
  );
}

/** Vendas do modelo escolhido: as mais recentes uma a uma e o lance final por ano-modelo. */
export async function getModelSales(filters: ResearchFilters): Promise<ModelSales | null> {
  await requireUser();
  if (filters.vehicle === null) return null;
  const where = salesWhere(filters, {});
  const [sales, byYear] = await Promise.all([
    listSales(where, MODEL_SALES_LIMIT),
    rows(
      z.object({ year: z.number().int().nullable(), ...statsShape }),
      sql`SELECT l.model_year::int AS year, ${statsColumns(sql`l.final_bid_cents::float8`)} FROM listings l
        WHERE ${where} GROUP BY 1 ORDER BY 1`,
    ),
  ]);
  return {
    total: byYear.reduce((total, row) => total + row.n, 0),
    sales,
    byYear: byYear.flatMap(({ year, ...row }) => (year === null ? [] : [{ year, summary: summarize(toStats(row)) }])),
  };
}

/**
 * "Como o lance sobe": para cada venda e marca (horas antes do fim), a última observação com lance nas
 * `BID_CURVE_LOOKBACK_HOURS` anteriores à marca, como proporção do lance final.
 */
export async function getBidCurve(filters: ResearchFilters): Promise<BidCurveView> {
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
}
