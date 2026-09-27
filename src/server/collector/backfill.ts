import "server-only";

import type { SourceAdapter } from "@/sources/types";

import { db } from "../db";

const PAGE_SIZE = 200;
/** Gravações simultâneas. Sem transação: cada linha é independente e rodar de novo regrava o mesmo valor. */
const CONCURRENCY = 10;

export type BackfillSummary = { scanned: number; updated: number; skipped: number };

/**
 * Preenche campos extraídos depois da coleta (descrição e condição) a partir do dado bruto guardado, sem baixar
 * as páginas de novo. Idempotente: rodar outra vez regrava os mesmos valores.
 */
export async function backfillListingDetails(adapter: SourceAdapter): Promise<BackfillSummary> {
  const summary: BackfillSummary = { scanned: 0, updated: 0, skipped: 0 };
  let cursor: string | undefined;

  for (;;) {
    const rows = await db.listing.findMany({
      where: { sourceId: adapter.id },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, raw: true },
    });
    if (rows.length === 0) return summary;
    cursor = rows.at(-1)?.id;
    summary.scanned += rows.length;

    const updates = rows.flatMap((row) => {
      const details = adapter.detailsFromRaw(row.raw);
      if (!details) {
        summary.skipped += 1;
        return [];
      }
      const { description, condition } = details;
      return [
        () =>
          db.listing.update({
            where: { id: row.id },
            data: {
              description,
              damageLevel: condition.damageLevel,
              conditionFlags: condition.flags,
              inspectionResult: condition.inspection,
              inspectionNotes: condition.inspectionNotes,
            },
            select: { id: true },
          }),
      ];
    });
    for (let start = 0; start < updates.length; start += CONCURRENCY) {
      await Promise.all(updates.slice(start, start + CONCURRENCY).map((update) => update()));
    }
    summary.updated += updates.length;
  }
}
