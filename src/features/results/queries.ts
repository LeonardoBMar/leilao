import "server-only";

import { cents } from "@/domain/money";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { LinkedAnalysis, LotResultContext, ResultRevision } from "./types";

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
    },
  });
  if (!lot) return null;

  const revisions = lot.results.map(toRevision);
  const fixedAnalyses = lot.analyses.map(toLinkedAnalysis).filter((analysis) => analysis !== null);
  const suggested = fixedAnalyses.find((analysis) => !analysis.knownResultAtCreation) ?? fixedAnalyses[0];

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
  };
}
