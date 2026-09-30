import "server-only";

import { listingOutcome } from "@/domain/listings/outcome";
import { shouldSyncBid } from "@/domain/listings/tracker";
import { cents } from "@/domain/money";
import { classifyAnalysisTiming, suggestedAnalysis } from "@/domain/results/results";

import { db, isUniqueViolation } from "../db";

const toCents = (value: number | null) => (value === null ? null : cents(value));

/**
 * Acompanhamento automático (etapa 3, D-34): leva o lance dos anúncios lidos nesta execução para os lotes ligados a
 * eles, de todos os usuários (lotes ativos). Só altera lance atual e data da observação (e o `updated_at`); o resto
 * do lote é do usuário.
 * Devolve quantos lotes mudaram.
 */
export async function syncTrackedLots(since: Date): Promise<number> {
  const lots = await db.lot.findMany({
    // Lote arquivado saiu do acompanhamento: fica com o último lance que tinha.
    where: { archivedAt: null, listing: { lastCheckedAt: { gte: since } } },
    select: {
      id: true,
      currentBidCents: true,
      currentBidObservedAt: true,
      listing: { select: { currentBidCents: true, lastCheckedAt: true } },
    },
  });

  let updated = 0;
  for (const lot of lots) {
    if (!lot.listing) continue;
    const listing = { currentBid: toCents(lot.listing.currentBidCents), lastCheckedAt: lot.listing.lastCheckedAt };
    if (
      !shouldSyncBid(
        { currentBid: toCents(lot.currentBidCents), currentBidObservedAt: lot.currentBidObservedAt },
        listing,
      )
    ) {
      continue;
    }
    // A condição repete o que foi lido: se o usuário digitou um lance agora, a gravação dele prevalece.
    const { count } = await db.lot.updateMany({
      where: { id: lot.id, currentBidCents: lot.currentBidCents, currentBidObservedAt: lot.currentBidObservedAt },
      data: { currentBidCents: listing.currentBid, currentBidObservedAt: listing.lastCheckedAt },
    });
    updated += count;
  }
  return updated;
}

/**
 * Resultado automático (etapa 4, D-35): lote ligado a anúncio com desfecho definitivo e ainda sem resultado ganha a
 * revisão 1, com `source = collector`, o link do anúncio e a análise sugerida (mesma regra do formulário). Desfecho
 * ambíguo não é gravado: a ficha mostra "resultado a confirmar". Não filtra pela execução: um anúncio encerrado não é
 * mais revisitado. Lote arquivado também recebe (resultado é histórico). Falha de um lote não impede os outros e
 * volta em `failures`; a próxima execução tenta de novo.
 */
export async function recordTrackedResults(
  now: Date,
): Promise<{ recorded: number; failures: { lotId: string; error: unknown }[] }> {
  const lots = await db.lot.findMany({
    where: { results: { none: {} }, listing: { status: { in: ["sold", "unsold", "withdrawn"] } } },
    select: {
      id: true,
      ownerId: true,
      listing: {
        select: {
          url: true,
          status: true,
          sourceStatus: true,
          currentBidCents: true,
          finalBidCents: true,
          endsAt: true,
          nextCheckAt: true,
          source: { select: { name: true } },
        },
      },
      analyses: {
        where: { status: "fixed" },
        orderBy: { version: "desc" },
        select: { id: true, fixedAt: true, knownResultAtCreation: true },
      },
    },
  });

  let recorded = 0;
  const failures: { lotId: string; error: unknown }[] = [];
  for (const lot of lots) {
    if (!lot.listing) continue;
    const outcome = listingOutcome(
      {
        status: lot.listing.status,
        currentBid: toCents(lot.listing.currentBidCents),
        finalBid: toCents(lot.listing.finalBidCents),
        endsAt: lot.listing.endsAt,
        checking: lot.listing.nextCheckAt !== null,
      },
      now,
    );
    if (outcome.kind !== "final") continue;

    const analysis = suggestedAnalysis(lot.analyses);
    const reported = lot.listing.sourceStatus ? ` (situação "${lot.listing.sourceStatus}")` : "";
    try {
      await db.result.create({
        data: {
          ownerId: lot.ownerId,
          lotId: lot.id,
          revision: 1,
          source: "collector",
          outcome: outcome.outcome,
          finalBidCents: outcome.finalBid,
          eventAt: outcome.eventAt,
          sourceUrl: lot.listing.url,
          sourceNotes: `Registrado automaticamente pelo coletor com o desfecho do ${lot.listing.source.name}${reported}.`,
          analysisId: analysis?.id ?? null,
          analysisTiming: analysis?.fixedAt
            ? classifyAnalysisTiming({
                analysisFixedAt: analysis.fixedAt,
                knownResultAtCreation: analysis.knownResultAtCreation,
                firstResultRecordedAt: now,
                eventAt: outcome.eventAt,
                priorDeclared: false,
              })
            : "unknown",
          recordedAt: now,
        },
      });
      recorded++;
    } catch (error) {
      // O usuário registrou o resultado no mesmo instante (único por lote e revisão): vale o dele.
      if (!isUniqueViolation(error)) failures.push({ lotId: lot.id, error });
    }
  }
  return { recorded, failures };
}
