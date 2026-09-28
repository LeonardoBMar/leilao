import "server-only";

import { isCategoryKey, isConditionKey } from "@/domain/listings/criteria";
import { cents } from "@/domain/money";
import { countOpenListings } from "@/features/listings/queries";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { WatchItem, WatchListItem } from "./types";

export const watchSelect = {
  id: true,
  name: true,
  search: true,
  yearFrom: true,
  yearTo: true,
  maxPriceCents: true,
  radiusKm: true,
  category: true,
  condition: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WatchSelect;

type WatchRow = Prisma.WatchGetPayload<{ select: typeof watchSelect }>;

export function toWatchItem(row: WatchRow): WatchItem {
  // O banco só aceita chaves conhecidas (CHECK); o fallback só existe para estreitar o tipo.
  return {
    id: row.id,
    name: row.name,
    criteria: {
      search: row.search,
      yearFrom: row.yearFrom,
      yearTo: row.yearTo,
      maxPrice: row.maxPriceCents === null ? null : cents(row.maxPriceCents),
      radiusKm: row.radiusKm,
      category: isCategoryKey(row.category) ? row.category : "todas",
      condition: isConditionKey(row.condition) ? row.condition : "qualquer",
    },
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Monitores do usuário, com quantos lotes abertos combinam agora e alertas não lidos. */
export async function listWatches(): Promise<WatchListItem[]> {
  const user = await requireUser();
  const [rows, unread] = await Promise.all([
    db.watch.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, select: watchSelect }),
    db.alert.groupBy({ by: ["watchId"], where: { ownerId: user.id, readAt: null }, _count: { _all: true } }),
  ]);
  const unreadByWatch = new Map(unread.map((group) => [group.watchId, group._count._all]));

  return Promise.all(
    rows.map(async (row) => {
      const watch = toWatchItem(row);
      const { count, truncated } = await countOpenListings(watch.criteria);
      return {
        ...watch,
        openMatches: count,
        openMatchesTruncated: truncated,
        unreadAlerts: unreadByWatch.get(row.id) ?? 0,
      };
    }),
  );
}

/** Devolve `null` para inexistente ou de outro dono; quem renderiza decide `notFound()`. */
export async function getWatch(id: string): Promise<WatchItem | null> {
  const user = await requireUser();
  const row = await db.watch.findFirst({ where: { id, ownerId: user.id }, select: watchSelect });
  return row ? toWatchItem(row) : null;
}
