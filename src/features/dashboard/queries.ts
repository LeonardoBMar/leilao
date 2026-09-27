import "server-only";

import type { FixedLimit } from "@/domain/finance/calculator";
import { cents } from "@/domain/money";
import { compareResult, limitIndicator } from "@/domain/results/results";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { DashboardSummary } from "./types";

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const user = await requireUser();
  // Lote ativo: não arquivado e de leilão não arquivado (RF-08).
  const activeLot = { ownerId: user.id, archivedAt: null, auction: { archivedAt: null } };

  const [activeAuctions, activeLots, followedLotsWithoutResult, analyzedLots, currentResults] = await Promise.all([
    db.auction.count({ where: { ownerId: user.id, archivedAt: null } }),
    db.lot.count({ where: activeLot }),
    db.lot.count({ where: { ...activeLot, isFollowed: true, results: { none: {} } } }),
    db.lot.count({ where: { ...activeLot, analyses: { some: { status: "fixed" } } } }),
    // Revisão vigente de cada lote: a de maior número (distinct após ordenar).
    db.result.findMany({
      where: { ownerId: user.id, lot: { archivedAt: null, auction: { archivedAt: null } } },
      orderBy: [{ lotId: "asc" }, { revision: "desc" }],
      distinct: ["lotId"],
      select: {
        outcome: true,
        finalBidCents: true,
        analysisTiming: true,
        analysis: { select: { isViable: true, maxBidCents: true } },
      },
    }),
  ]);

  const indicator = limitIndicator(
    currentResults.map((result) => {
      const limit: FixedLimit | null = !result.analysis
        ? null
        : result.analysis.isViable && result.analysis.maxBidCents !== null
          ? { isViable: true, maxBid: cents(result.analysis.maxBidCents) }
          : { isViable: false };
      return {
        timing: result.analysisTiming,
        comparison: compareResult({
          outcome: result.outcome,
          finalBid: result.finalBidCents === null ? null : cents(result.finalBidCents),
          limit,
        }),
      };
    }),
  );

  return { activeAuctions, activeLots, followedLotsWithoutResult, analyzedLots, indicator };
}
