import "server-only";

import { listingOutcome } from "@/domain/listings/outcome";
import { cents } from "@/domain/money";
import { suggestedAnalysis } from "@/domain/results/results";
import type { Prisma } from "@/generated/prisma/client";
import { formatBRL } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { LinkedAnalysis, LotResultContext, ResultPrefill, ResultRevision, ResultTracking } from "./types";

const money = (value: number | null) => (value === null ? null : cents(value));

const analysisSelect = {
  id: true,
  version: true,
  isViable: true,
  maxBidCents: true,
  fixedAt: true,
  knownResultAtCreation: true,
} satisfies Prisma.AnalysisSelect;

type AnalysisRow = Prisma.AnalysisGetPayload<{ select: typeof analysisSelect }>;

/** Só versões fixadas entram aqui; saídas e data de fixação existem por constraint do banco. */
function toLinkedAnalysis(row: AnalysisRow): LinkedAnalysis | null {
  if (row.isViable === null || row.fixedAt === null) return null;
  return {
    id: row.id,
    version: row.version,
    isViable: row.isViable,
    maxBid: money(row.maxBidCents),
    fixedAt: row.fixedAt,
    knownResultAtCreation: row.knownResultAtCreation,
  };
}

const revisionSelect = {
  id: true,
  revision: true,
  outcome: true,
  finalBidCents: true,
  eventAt: true,
  sourceUrl: true,
  sourceNotes: true,
  personalOutcome: true,
  decisionReason: true,
  notes: true,
  analysisTiming: true,
  priorDeclared: true,
  recordedAt: true,
  correctionReason: true,
  source: true,
  analysis: { select: analysisSelect },
} satisfies Prisma.ResultSelect;

type RevisionRow = Prisma.ResultGetPayload<{ select: typeof revisionSelect }>;

function toRevision({ finalBidCents, analysis, ...row }: RevisionRow): ResultRevision {
  return { ...row, finalBid: money(finalBidCents), analysis: analysis ? toLinkedAnalysis(analysis) : null };
}

/** Tudo que a ficha e o formulário de resultado precisam. `null` para lote inexistente ou de outro dono. */
export async function getLotResultContext(lotId: string): Promise<LotResultContext | null> {
  const user = await requireUser();
  const lot = await db.lot.findFirst({
    where: { id: lotId, ownerId: user.id },
    select: {
      id: true,
      lotNumber: true,
      brand: true,
      model: true,
      modelYear: true,
      auction: { select: { id: true, name: true, startsAt: true } },
      results: { orderBy: { revision: "desc" }, select: revisionSelect },
      analyses: { where: { status: "fixed" }, orderBy: { version: "desc" }, select: analysisSelect },
      listing: {
        select: {
          url: true,
          status: true,
          currentBidCents: true,
          finalBidCents: true,
          endsAt: true,
          nextCheckAt: true,
          source: { select: { name: true } },
        },
      },
    },
  });
  if (!lot) return null;

  const revisions = lot.results.map(toRevision);
  const fixedAnalyses = lot.analyses.map(toLinkedAnalysis).filter((analysis) => analysis !== null);
  const suggested = suggestedAnalysis(fixedAnalyses);
  const tracking: ResultTracking | null = lot.listing && {
    sourceName: lot.listing.source.name,
    url: lot.listing.url,
    outcome: listingOutcome(
      {
        status: lot.listing.status,
        currentBid: money(lot.listing.currentBidCents),
        finalBid: money(lot.listing.finalBidCents),
        endsAt: lot.listing.endsAt,
        checking: lot.listing.nextCheckAt !== null,
      },
      new Date(),
    ),
  };

  return {
    lot: {
      id: lot.id,
      lotNumber: lot.lotNumber,
      title: `${lot.brand} ${lot.model} ${lot.modelYear}`,
      auction: lot.auction,
    },
    current: revisions[0] ?? null,
    revisions,
    fixedAnalyses,
    suggestedAnalysisId: suggested?.id ?? null,
    tracking,
    prefill: revisions.length === 0 && tracking ? prefillFrom(tracking) : null,
  };
}

/** Desfecho da fonte → valores iniciais do formulário, com a origem descrita (o usuário revisa e salva). */
function prefillFrom({ sourceName, url, outcome }: ResultTracking): ResultPrefill | null {
  switch (outcome.kind) {
    case "pending":
      return null;
    case "final":
      return {
        outcome: outcome.outcome,
        finalBid: outcome.finalBid,
        eventAt: outcome.eventAt,
        sourceUrl: url,
        sourceNotes: `Desfecho informado pelo ${sourceName}.`,
      };
    case "to_confirm": {
      const bid = outcome.lastBid === null ? "sem lance" : `último lance ${formatBRL(outcome.lastBid)}`;
      return {
        outcome: null,
        finalBid: outcome.lastBid,
        eventAt: outcome.eventAt,
        sourceUrl: url,
        sourceNotes:
          outcome.reason === "conditional"
            ? `${sourceName}: venda condicional (${bid}), à espera da aprovação do vendedor.`
            : `${sourceName}: desfecho não informado (${bid}).`,
      };
    }
  }
}
