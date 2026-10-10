import "server-only";

import type { FipeTable } from "@/domain/listings/fipe-match";

import { db } from "../db";
import { createFipeClient, FipeUnavailableError } from "./client";
import { evaluateListing, pendingListingSelect } from "./enrich";
import { notFromSource } from "./matches";

/**
 * Preenchimento de D-49 sem rede: os anúncios já casados antes das correlações recebem a sua (`fipe_match_id`),
 * refazendo a escolha sobre as respostas guardadas. Valor recalculado igual ao gravado: só liga. Diferente: lista e,
 * com `requeueDiffs`, devolve o anúncio à fila para ser casado de novo (o gravado nunca é sobrescrito aqui).
 */
export type LinkDiff = {
  listingId: string;
  title: string;
  stored: { origin: string | null; value: number | null };
  computed: { origin: string | null; value: number | null };
};

export type LinkSummary = { read: number; linked: number; diffs: number; requeued: number; notCached: number };

const OFFLINE_ERROR = "resposta fora do cache";

export async function linkCheckedListings(input: {
  requeueDiffs: boolean;
  onDiff?: (diff: LinkDiff) => void;
}): Promise<LinkSummary> {
  const summary: LinkSummary = { read: 0, linked: 0, diffs: 0, requeued: 0, notCached: 0 };
  // Só o cache: um pedido que faltar vira erro, e o anúncio fica como está.
  const client = createFipeClient(async () => {
    throw new FipeUnavailableError(OFFLINE_ERROR);
  });
  const tables = await loadCachedTables(client);
  if (tables === null) return summary;
  const seen = new Set<string>();

  for (;;) {
    const batch = await db.listing.findMany({
      where: {
        id: { notIn: [...seen] },
        marketValueCheckedAt: { not: null },
        fipeMatchId: null,
        ...notFromSource,
      },
      orderBy: { id: "asc" },
      take: 200,
      select: { ...pendingListingSelect, marketValueCents: true, marketValueOrigin: true },
    });
    if (batch.length === 0) return summary;
    for (const listing of batch) {
      seen.add(listing.id);
      summary.read++;
      let sample;
      try {
        ({ sample } = await evaluateListing(client, tables, listing));
      } catch (error) {
        if (error instanceof FipeUnavailableError) {
          summary.notCached++;
          continue;
        }
        throw error;
      }
      if (sample === null || sample.matchId === null) {
        summary.notCached++;
        continue;
      }
      const computed = { origin: sample.match?.origin ?? null, value: sample.match?.value ?? null };
      const stored = { origin: listing.marketValueOrigin, value: listing.marketValueCents };
      if (computed.origin === stored.origin && computed.value === stored.value) {
        await db.listing.updateMany({
          where: { id: listing.id, fipeMatchId: null, ...notFromSource },
          data: { fipeMatchId: sample.matchId },
        });
        summary.linked++;
        continue;
      }
      summary.diffs++;
      input.onDiff?.({ listingId: listing.id, title: listing.title, stored, computed });
      if (input.requeueDiffs) {
        await db.listing.updateMany({
          where: { id: listing.id, ...notFromSource },
          data: { marketValueCheckedAt: null, fipeMatchId: sample.matchId },
        });
        summary.requeued++;
      }
    }
  }
}

/** A lista de tabelas guardada mais recente (a do dia pode não estar no cache). */
async function loadCachedTables(client: ReturnType<typeof createFipeClient>): Promise<FipeTable[] | null> {
  try {
    return await client.tables();
  } catch {
    const latest = await db.fipeResponse.findFirst({
      where: { key: { startsWith: "tabelas:" } },
      orderBy: { key: "desc" },
      select: { key: true },
    });
    if (!latest) return null;
    const day = latest.key.slice("tabelas:".length);
    const dated = createFipeClient(
      async () => {
        throw new FipeUnavailableError(OFFLINE_ERROR);
      },
      () => new Date(`${day}T12:00:00Z`),
    );
    return dated.tables().catch(() => null);
  }
}
