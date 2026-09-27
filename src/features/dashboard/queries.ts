import "server-only";

import type { FixedLimit } from "@/domain/finance/calculator";
import { cents } from "@/domain/money";
import { compareResult, limitIndicator } from "@/domain/results/results";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { DashboardSummary, PendingItems } from "./types";

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

const PENDING_LIMIT = 5;

/**
 * Pendências do dashboard: rascunhos de análise abertos e lotes acompanhados cujo leilão já começou e ainda não
 * têm resultado. Só registros ativos.
 */
export async function getPendingItems(): Promise<PendingItems> {
  const user = await requireUser();
  const activeLot = { archivedAt: null, auction: { archivedAt: null } };

  const [drafts, awaiting] = await Promise.all([
    db.analysis.findMany({
      where: { ownerId: user.id, status: "draft", lot: activeLot },
      orderBy: { updatedAt: "desc" },
      take: PENDING_LIMIT,
      select: {
        id: true,
        version: true,
        updatedAt: true,
        lot: { select: { id: true, lotNumber: true, brand: true, model: true } },
      },
    }),
    db.lot.findMany({
      where: {
        ownerId: user.id,
        ...activeLot,
        isFollowed: true,
        results: { none: {} },
        auction: { archivedAt: null, startsAt: { lt: new Date() } },
      },
      orderBy: { auction: { startsAt: "asc" } },
      take: PENDING_LIMIT,
      select: {
        id: true,
        lotNumber: true,
        brand: true,
        model: true,
        auction: { select: { name: true, startsAt: true } },
      },
    }),
  ]);

  return {
    drafts: drafts.map(({ id, version, updatedAt, lot }) => ({
      analysisId: id,
      version,
      lotId: lot.id,
      lotLabel: `Lote ${lot.lotNumber} · ${lot.brand} ${lot.model}`,
      updatedAt,
    })),
    awaitingResult: awaiting.map((lot) => ({
      lotId: lot.id,
      lotLabel: `Lote ${lot.lotNumber} · ${lot.brand} ${lot.model}`,
      auctionName: lot.auction.name,
      startsAt: lot.auction.startsAt,
    })),
  };
}
