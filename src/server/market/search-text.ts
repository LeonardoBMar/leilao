import "server-only";

import { listingSearchText } from "@/domain/listings/criteria";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

const READ_BATCH = 500;

/**
 * Recalcula `listings.search_text` (D-91) em todo o catálogo via cursor de `id`.
 * Idempotente: só atualiza anúncios cujo texto normalizado mudou, em um único UPDATE em lote por página (`unnest`).
 */
export async function backfillSearchText(): Promise<{ scanned: number; updated: number }> {
  let cursor: string | undefined;
  let scanned = 0;
  let updated = 0;

  for (;;) {
    const batch = await db.listing.findMany({
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      orderBy: { id: "asc" },
      take: READ_BATCH,
      select: { id: true, title: true, brand: true, model: true, fipeName: true, searchText: true },
    });
    if (batch.length === 0) break;
    scanned += batch.length;
    cursor = batch.at(-1)?.id;

    const changed = batch.flatMap((row) => {
      const next = listingSearchText(row);
      return next === row.searchText ? [] : [{ id: row.id, searchText: next }];
    });
    if (changed.length > 0) {
      const ids = changed.map((item) => item.id);
      const texts = changed.map((item) => item.searchText);
      await db.$executeRaw(Prisma.sql`
        UPDATE listings l
        SET search_text = v.search_text
        FROM unnest(${ids}::uuid[], ${texts}::text[]) AS v(id, search_text)
        WHERE l.id = v.id
      `);
      updated += changed.length;
    }
  }

  return { scanned, updated };
}
