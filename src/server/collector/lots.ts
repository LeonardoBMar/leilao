import "server-only";

import { shouldSyncBid } from "@/domain/listings/tracker";
import { cents } from "@/domain/money";

import { db } from "../db";

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
