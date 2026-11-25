import "server-only";

import { z } from "zod";

import { DAMAGE_LEVELS } from "@/domain/listings/condition";
import { CATEGORY_OF_KEY } from "@/domain/listings/criteria";
import { SALES_WINDOW_MS } from "@/domain/listings/estimates";
import { type Coordinates, EARTH_RADIUS_KM } from "@/domain/listings/geo";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { DAMAGE_OF_CONDITION, periodStart, type ResearchFilters } from "@/domain/research/filters";
import { type GroupStats, RATIO_BOUNDS } from "@/domain/research/summary";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/** Tag de cache compartilhada pelos blocos analíticos globais do Mercado (D-78, D-93). */
export const RESEARCH_CACHE_TAG = "catalog-research";

/** Remove campos que não afetam a consulta para evitar cache miss à toa (ex.: abrir `?venda=`). */
export function cacheKeyFilters(
  filters: ResearchFilters,
  options: { keepMetric?: boolean; keepCompare?: boolean } = {},
): ResearchFilters {
  return {
    ...filters,
    sale: null,
    metric: options.keepMetric ? filters.metric : "ratio",
    compare: options.keepCompare ? filters.compare : null,
  };
}

/** Vendas de um modelo devolvidas uma a uma (dispersão e tabela). */
export const MODEL_SALES_LIMIT = 500;

/**
 * Até quantos modelos a busca conhece (os de mais vendas primeiro). Alto o bastante para a cauda longa do catálogo
 * entrar; cada modelo pesa poucos bytes na barra.
 */
export const MODEL_SUGGESTIONS_LIMIT = 2000;

export const sql = Prisma.sql;
export const RATIO = sql`(l.final_bid_cents::float8 / l.market_value_cents)`;
/** Chave do veículo gravada pela coleta (D-77): filtrar e agrupar por ela usa o índice e evita a regra por linha. */
export const VEHICLE_KEY = sql`l.vehicle_key`;

/** Distância em linha reta (haversine, km) da região configurada até a cidade do pátio; sem cidade, `NULL`. */
export function distanceKmSql(center: Coordinates = DEFAULT_REGION.center) {
  const { latitude, longitude } = center;
  return sql`2 * ${EARTH_RADIUS_KM}::float8 * asin(least(1, sqrt(
    power(sin(radians(m.latitude - ${latitude}::float8) / 2), 2)
    + cos(radians(${latitude}::float8)) * cos(radians(m.latitude)) * power(sin(radians(m.longitude - ${longitude}::float8) / 2), 2))))`;
}

export type SalesScope = {
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

/** Início da janela das estimativas, contada de agora ou de `until`. */
export function salesSince(until: Date | null = null): Date {
  return new Date((until?.getTime() ?? Date.now()) - SALES_WINDOW_MS);
}

/** Venda (mesmo critério da base do preço provável) dentro dos filtros pedidos. */
export function salesWhere(
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
  if (filters.period !== null) parts.push(sql`l.ends_at >= ${periodStart(filters.period, new Date())}`);
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
export function statsColumns(value: Prisma.Sql) {
  return sql`count(*)::int AS n,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY ${value}) AS p25,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ${value}) AS median,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY ${value}) AS p75`;
}

export const statsShape = { n: z.number().int(), p25: z.number(), median: z.number(), p75: z.number() };
export const levelSchema = z.enum([...DAMAGE_LEVELS, "unclassified"]);

export async function rows<T extends z.ZodType>(schema: T, query: Prisma.Sql): Promise<z.infer<T>[]> {
  const result = await db.$queryRaw<unknown[]>(query);
  return z.array(schema).parse(result);
}

/** Só os campos do resumo (a linha pode trazer outros, como o estado ou o máximo). */
export function toStats({ n, p25, median, p75 }: GroupStats): GroupStats {
  return { n, p25, median, p75 };
}

/** Nomes das versões FIPE mais recentes para uma lista de códigos. */
export async function loadFipeVersionLabels(codes: readonly string[]): Promise<Record<string, string>> {
  const unique = [...new Set(codes)];
  if (unique.length === 0) return {};
  const labels = await rows(
    z.object({ code: z.string(), name: z.string() }),
    sql`SELECT DISTINCT ON (p.fipe_code) p.fipe_code AS code, p.model_name AS name FROM fipe_prices p
      WHERE p.fipe_code IN (${Prisma.join(unique)}) ORDER BY p.fipe_code, p.reference_month DESC`,
  );
  return Object.fromEntries(labels.map(({ code, name }) => [code, name]));
}
