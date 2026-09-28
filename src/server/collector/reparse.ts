import "server-only";

import { isFinalStatus, type ListingStatus } from "@/domain/listings/types";
import type { SourceAdapter } from "@/sources/types";

import { db } from "../db";

const PAGE_SIZE = 200;
/** Gravações simultâneas. Sem transação por lote: cada anúncio é independente e rodar de novo regrava o mesmo valor. */
const CONCURRENCY = 10;
/** Situações que o dado bruto pode impor. "Aberto" e "desconhecido" nunca sobrescrevem: o bruto pode estar velho. */
const OUTCOMES: readonly ListingStatus[] = ["sold", "conditional", "unsold", "withdrawn"];

export type ReparseSummary = { scanned: number; updated: number; statusChanged: number; skipped: number };

/**
 * Rederiva do dado bruto guardado (`listings.raw`) o que a extração passou a entender depois da coleta: descrição,
 * condição e situação (ex.: uma situação da fonte mapeada depois). Não baixa páginas, então serve também para anúncios
 * cuja página já saiu do ar. Idempotente.
 */
export async function reparseListings(adapter: SourceAdapter, now: Date): Promise<ReparseSummary> {
  const summary: ReparseSummary = { scanned: 0, updated: 0, statusChanged: 0, skipped: 0 };
  let cursor: string | undefined;

  for (;;) {
    const rows = await db.listing.findMany({
      where: { sourceId: adapter.id },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, raw: true, status: true, currentBidCents: true, bidCount: true },
    });
    if (rows.length === 0) return summary;
    cursor = rows.at(-1)?.id;
    summary.scanned += rows.length;

    const updates = rows.flatMap((row) => {
      const details = adapter.detailsFromRaw(row.raw, now);
      if (!details) {
        summary.skipped += 1;
        return [];
      }
      const { description, condition } = details;
      const newStatus = OUTCOMES.includes(details.status) && details.status !== row.status ? details.status : null;
      if (newStatus) summary.statusChanged += 1;
      const data = {
        description,
        damageLevel: condition.damageLevel,
        conditionFlags: condition.flags,
        inspectionResult: condition.inspection,
        inspectionNotes: condition.inspectionNotes,
        ...(newStatus
          ? {
              status: newStatus,
              sourceStatus: details.sourceStatus,
              // Desfecho definitivo não precisa de revisita; condicional segue na agenda que já tinha.
              ...(isFinalStatus(newStatus) ? { nextCheckAt: null } : {}),
            }
          : {}),
      };
      return [
        () =>
          newStatus
            ? db.$transaction([
                db.listing.update({ where: { id: row.id }, data, select: { id: true } }),
                db.listingObservation.create({
                  data: {
                    listingId: row.id,
                    observedAt: now,
                    status: newStatus,
                    bidCents: row.currentBidCents,
                    bidCount: row.bidCount,
                  },
                }),
              ])
            : db.listing.update({ where: { id: row.id }, data, select: { id: true } }),
      ];
    });
    for (let start = 0; start < updates.length; start += CONCURRENCY) {
      await Promise.all(updates.slice(start, start + CONCURRENCY).map((update) => update()));
    }
    summary.updated += updates.length;
  }
}
