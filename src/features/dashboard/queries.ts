import "server-only";

import type { FixedLimit } from "@/domain/finance/calculator";
import { listingOutcome } from "@/domain/listings/outcome";
import { cents } from "@/domain/money";
import { compareResult, limitIndicator } from "@/domain/results/results";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { DashboardCounts, LimitIndicator, PendingItems } from "./types";

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const user = await requireUser();
  // Lote ativo: não arquivado e de leilão não arquivado (RF-08).
  const activeLot = { ownerId: user.id, archivedAt: null, auction: { archivedAt: null } };

  const [activeAuctions, activeLots, followedLotsWithoutResult, analyzedLots] = await Promise.all([
    db.auction.count({ where: { ownerId: user.id, archivedAt: null } }),
    db.lot.count({ where: activeLot }),
    db.lot.count({ where: { ...activeLot, isFollowed: true, results: { none: {} } } }),
    db.lot.count({ where: { ...activeLot, analyses: { some: { status: "fixed" } } } }),
  ]);
  return { activeAuctions, activeLots, followedLotsWithoutResult, analyzedLots };
}

/** Indicador do SPEC §10 sobre a revisão vigente de cada lote ativo. */
export async function getLimitIndicator(): Promise<LimitIndicator> {
  const user = await requireUser();
  // Revisão vigente de cada lote: a de maior número (distinct após ordenar).
  const currentResults = await db.result.findMany({
    where: { ownerId: user.id, lot: { archivedAt: null, auction: { archivedAt: null } } },
    orderBy: [{ lotId: "asc" }, { revision: "desc" }],
    distinct: ["lotId"],
    select: {
      outcome: true,
      finalBidCents: true,
      analysisTiming: true,
      analysis: { select: { isViable: true, maxBidCents: true } },
    },
  });

  return limitIndicator(
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
}

const PENDING_LIMIT = 5;
const PENDING_CANDIDATES = 50;

const toCents = (value: number | null) => (value === null ? null : cents(value));

/**
 * Pendências do dashboard: rascunhos de análise abertos e lotes acompanhados cujo leilão já começou e ainda não
 * têm resultado. Lote ligado a anúncio só entra com resultado a confirmar; o resto o coletor registra. Só ativos.
 */
export async function getPendingItems(): Promise<PendingItems> {
  const user = await requireUser();
  const now = new Date();
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
        // Ligado a anúncio: só os que podem estar "a confirmar"; o filtro abaixo aplica a regra exata (listingOutcome).
        OR: [
          { listingId: null },
          { listing: { status: { in: ["conditional", "unknown"] } } },
          { listing: { status: "open", nextCheckAt: null } },
        ],
        auction: { archivedAt: null, startsAt: { lt: now } },
      },
      orderBy: { auction: { startsAt: "asc" } },
      // Folga para os abertos que ainda não encerraram (saem no filtro abaixo).
      take: PENDING_CANDIDATES,
      select: {
        id: true,
        lotNumber: true,
        brand: true,
        model: true,
        auction: { select: { name: true, startsAt: true } },
        listing: {
          select: { status: true, currentBidCents: true, finalBidCents: true, endsAt: true, nextCheckAt: true },
        },
      },
    }),
  ]);

  // Lote ligado a anúncio (etapa 4): só é pendência quando o desfecho é ambíguo ("a confirmar").
  const awaitingResult = awaiting
    .map((lot) => {
      const outcome =
        lot.listing &&
        listingOutcome(
          {
            status: lot.listing.status,
            currentBid: toCents(lot.listing.currentBidCents),
            finalBid: toCents(lot.listing.finalBidCents),
            endsAt: lot.listing.endsAt,
            checking: lot.listing.nextCheckAt !== null,
          },
          now,
        );
      return {
        lot,
        toConfirm: outcome?.kind === "to_confirm",
        automatic: outcome !== null && outcome.kind !== "to_confirm",
      };
    })
    .filter((item) => !item.automatic)
    .slice(0, PENDING_LIMIT);

  return {
    drafts: drafts.map(({ id, version, updatedAt, lot }) => ({
      analysisId: id,
      version,
      lotId: lot.id,
      lotLabel: `Lote ${lot.lotNumber} · ${lot.brand} ${lot.model}`,
      updatedAt,
    })),
    awaitingResult: awaitingResult.map(({ lot, toConfirm }) => ({
      lotId: lot.id,
      lotLabel: `Lote ${lot.lotNumber} · ${lot.brand} ${lot.model}`,
      auctionName: lot.auction.name,
      startsAt: lot.auction.startsAt,
      toConfirm,
    })),
  };
}
