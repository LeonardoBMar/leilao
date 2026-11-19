import "server-only";

import { cache } from "react";

import { type FixedLimit, prepareFixedAnalysis } from "@/domain/finance/calculator";
import { listingOutcome } from "@/domain/listings/outcome";
import { cents } from "@/domain/money";
import { compareResult, limitIndicator } from "@/domain/results/results";
import { analysisColumns, toInputs } from "@/features/analyses/queries";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { LimitIndicator, PendingItems } from "./types";

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
 * Memo por requisição: o cabeçalho do dashboard conta as pendências (D-44).
 */
export const getPendingItems = cache(async (): Promise<PendingItems> => {
  const user = await requireUser();
  const now = new Date();
  const activeLot = { archivedAt: null, auction: { archivedAt: null } };

  const [rawDrafts, awaiting] = await Promise.all([
    db.analysis.findMany({
      where: { ownerId: user.id, status: "draft", lot: activeLot },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        version: true,
        ...analysisColumns,
        lot: {
          select: {
            id: true,
            lotNumber: true,
            brand: true,
            model: true,
            auction: { select: { name: true, startsAt: true } },
          },
        },
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

  const allDrafts = rawDrafts.map((draft) => ({
    analysisId: draft.id,
    version: draft.version,
    lotId: draft.lot.id,
    lotLabel: `Lote ${draft.lot.lotNumber} · ${draft.lot.brand} ${draft.lot.model}`,
    auctionName: draft.lot.auction.name,
    startsAt: draft.lot.auction.startsAt,
    canFix: prepareFixedAnalysis(toInputs(draft)).ok,
  }));

  // Lote ligado a anúncio (etapa 4): só é pendência quando o desfecho é ambíguo ("a confirmar").
  const pendingAwaiting = awaiting.filter((lot) => {
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
    return outcome === null || outcome.kind === "to_confirm";
  });

  return {
    drafts: allDrafts.slice(0, PENDING_LIMIT),
    draftsTotal: allDrafts.length,
    fixableDraftsTotal: allDrafts.filter((draft) => draft.canFix).length,
    awaitingResult: pendingAwaiting.slice(0, PENDING_LIMIT).map((lot) => ({
      lotId: lot.id,
      lotLabel: `Lote ${lot.lotNumber} · ${lot.brand} ${lot.model}`,
      auctionName: lot.auction.name,
      startsAt: lot.auction.startsAt,
    })),
    awaitingResultTotal: pendingAwaiting.length,
  };
});
