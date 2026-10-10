import "server-only";

import { classifyAnalysisTiming } from "@/domain/results/results";
import { err, ok, type Result } from "@/lib/result";
import { requireUser } from "@/server/auth";
import { db, isUniqueViolation } from "@/server/db";

import { resolveEventAt } from "./event-time";
import type { ResultInput } from "./schemas";

export type RecordResultError = "lot_not_found" | "analysis_not_found" | "stale" | "invalid_date";

/** CHECK do banco: correção sempre tem motivo. O modal não pede; fica registrado que não foi informado. */
const DEFAULT_CORRECTION_REASON = "Corrigido pela ficha do lote (motivo não informado).";

/**
 * Registra o resultado do lote ou uma correção (RF-06). Sempre insere uma nova revisão: a anterior e o motivo
 * são preservados (CA-14). A temporalidade da análise vinculada é calculada aqui (SPEC §10), nunca pelo cliente.
 * Fonte, motivo da decisão e observações repetem os da revisão anterior; sem ela, a fonte é o anúncio ligado.
 */
export async function recordResult(lotId: string, input: ResultInput): Promise<Result<null, RecordResultError>> {
  const user = await requireUser();

  try {
    return await db.$transaction(async (tx) => {
      const lot = await tx.lot.findFirst({
        where: { id: lotId, ownerId: user.id },
        select: { auction: { select: { startsAt: true } }, listing: { select: { url: true, endsAt: true } } },
      });
      if (!lot) return err("lot_not_found");

      const revisions = await tx.result.findMany({
        where: { lotId, ownerId: user.id },
        orderBy: { revision: "desc" },
        select: {
          id: true,
          revision: true,
          recordedAt: true,
          eventAt: true,
          priorDeclared: true,
          sourceUrl: true,
          sourceNotes: true,
          decisionReason: true,
          notes: true,
        },
      });
      const latest = revisions[0];
      const first = revisions.at(-1);
      // O formulário foi aberto sobre outra revisão (ex.: correção salva em outra aba).
      if ((latest?.revision ?? 0) !== input.baseRevision) return err("stale");

      const now = new Date();
      let eventAt: Date | null = null;
      if (input.eventDate) {
        eventAt = resolveEventAt(
          input.eventDate,
          [latest?.eventAt ?? null, lot.listing?.endsAt ?? null, lot.auction.startsAt],
          now,
        );
        if (!eventAt) return err("invalid_date");
      }
      // Declaração antiga ("análise anterior ao desfecho") só vale enquanto o horário segue desconhecido.
      const priorDeclared = Boolean(input.analysisId) && eventAt === null && (latest?.priorDeclared ?? false);

      let analysisTiming: "prior" | "retrospective" | "unknown" = "unknown";
      if (input.analysisId) {
        // Composta (analysis_id, lot_id) no banco garante o mesmo lote; aqui também exigimos versão fixada (CA-16).
        const analysis = await tx.analysis.findFirst({
          where: { id: input.analysisId, lotId, ownerId: user.id, status: "fixed" },
          select: { fixedAt: true, knownResultAtCreation: true },
        });
        if (!analysis?.fixedAt) return err("analysis_not_found");
        analysisTiming = classifyAnalysisTiming({
          analysisFixedAt: analysis.fixedAt,
          knownResultAtCreation: analysis.knownResultAtCreation,
          firstResultRecordedAt: first?.recordedAt ?? now,
          eventAt,
          priorDeclared,
        });
      }

      const isCorrection = latest !== undefined;
      await tx.result.create({
        data: {
          ownerId: user.id,
          lotId,
          revision: (latest?.revision ?? 0) + 1,
          supersedesResultId: latest?.id ?? null,
          outcome: input.outcome,
          finalBidCents: input.outcome === "sold" ? (input.finalBid ?? null) : null,
          eventAt,
          sourceUrl: latest ? latest.sourceUrl : (lot.listing?.url ?? null),
          sourceNotes: latest?.sourceNotes ?? null,
          personalOutcome: input.personalOutcome,
          decisionReason: latest?.decisionReason ?? null,
          notes: latest?.notes ?? null,
          analysisId: input.analysisId ?? null,
          analysisTiming,
          priorDeclared,
          correctionReason: isCorrection ? (input.correctionReason ?? DEFAULT_CORRECTION_REASON) : null,
        },
      });
      return ok(null);
    });
  } catch (error) {
    // Duas revisões com o mesmo número ao mesmo tempo: a segunda perde (unique lot_id + revision).
    if (isUniqueViolation(error)) return err("stale");
    throw error;
  }
}
