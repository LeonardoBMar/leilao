import "server-only";

import { cache } from "react";
import { z } from "zod";

import { cents } from "@/domain/money";
import { type ResearchFilters } from "@/domain/research/filters";
import { saleBidSteps } from "@/domain/research/sale-bids";
import { BID_CURVE_HOURS, BID_CURVE_LOOKBACK_HOURS, bidCurve } from "@/domain/research/summary";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { BidCurveView, SaleBids } from "../types";
import { rows, salesSince, salesWhere, sql, statsColumns, statsShape, toStats } from "./sql";

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
