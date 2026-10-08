import "server-only";

import { criteriaFromStored } from "@/domain/listings/criteria";
import { countOpenListings } from "@/features/listings/queries";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { storedCriteriaSelect } from "@/server/collector/alerts";
import { db } from "@/server/db";

import { describeCriteria } from "./summary";
import type { WatchItem, WatchListItem } from "./types";

export const watchSelect = {
  id: true,
  name: true,
  ...storedCriteriaSelect,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WatchSelect;

type WatchRow = Prisma.WatchGetPayload<{ select: typeof watchSelect }>;

export function toWatchItem({ id, name, active, createdAt, updatedAt, ...stored }: WatchRow): WatchItem {
  return { id, name, criteria: criteriaFromStored(stored), active, createdAt, updatedAt };
}

/** Monitores do usuário, com quantos lotes abertos combinam agora e alertas não lidos. */
export async function listWatches(): Promise<WatchListItem[]> {
  const user = await requireUser();
  const [rows, unread, sources] = await Promise.all([
    db.watch.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, select: watchSelect }),
    db.alert.groupBy({ by: ["watchId"], where: { ownerId: user.id, readAt: null }, _count: { _all: true } }),
    db.source.findMany({ select: { id: true, name: true } }),
  ]);
  const unreadByWatch = new Map(unread.map((group) => [group.watchId, group._count._all]));
  const sourceNames = Object.fromEntries(sources.map((source) => [source.id, source.name]));

  return Promise.all(
    rows.map(async (row) => {
      const watch = toWatchItem(row);
      const { count, truncated } = await countOpenListings(watch.criteria);
      return {
        ...watch,
        description: describeCriteria(watch.criteria, sourceNames),
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
