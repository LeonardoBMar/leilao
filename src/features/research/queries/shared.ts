import "server-only";

import { z } from "zod";

import { DAMAGE_LEVELS } from "@/domain/listings/condition";
import { MARKET_VALUE_ORIGINS } from "@/domain/listings/fipe-match";
import { cents } from "@/domain/money";
import { SALE_BIDS_WINDOW_HOURS } from "@/domain/research/sale-bids";
import { isStateCode } from "@/domain/research/states";
import { type GroupStats, HISTOGRAM_STEP, isRatioInBounds } from "@/domain/research/summary";
import { type Prisma } from "@/generated/prisma/client";

import type { ResearchSale } from "../types";
import { RATIO, rows, sql, statsColumns, statsShape, toStats } from "./sql";

/** Resumo e histograma do % do valor de mercado num recorte, mais a maior proporção (fim do eixo). */
export async function ratioDistribution(
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
export async function listSales(where: Prisma.Sql, limit: number): Promise<ResearchSale[]> {
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
