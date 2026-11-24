import "server-only";

import { criteriaFromStored } from "@/domain/listings/criteria";
import { countOpenListings } from "@/features/listings/queries";
import { getUserPreferences } from "@/features/preferences/queries";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { catalogSources } from "@/server/catalog-values";
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

/** Limite de contagens concorrentes para não saturar o pool (`DB_POOL_MAX = 5`) com muitos monitores. */
const WATCH_COUNT_CONCURRENCY = 3;

/** Monitores do usuário, com quantos lotes abertos combinam agora e alertas não lidos. */
export async function listWatches(): Promise<WatchListItem[]> {
  const user = await requireUser();
  const [rows, unread, sources, { region }] = await Promise.all([
    db.watch.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, select: watchSelect }),
    db.alert.groupBy({ by: ["watchId"], where: { ownerId: user.id, readAt: null }, _count: { _all: true } }),
    catalogSources(),
    getUserPreferences(),
  ]);
  const unreadByWatch = new Map(unread.map((group) => [group.watchId, group._count._all]));
  const sourceNames = Object.fromEntries(sources.map((source) => [source.id, source.name]));
  const now = new Date();

  const results = new Array<WatchListItem>(rows.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < rows.length) {
      const index = cursor;
      cursor += 1;
      const row = rows[index];
      if (!row) continue;
      const watch = toWatchItem(row);
      results[index] = {
        ...watch,
        description: describeCriteria(watch.criteria, sourceNames),
        openMatches: await countOpenListings(watch.criteria, { region, now }),
        unreadAlerts: unreadByWatch.get(row.id) ?? 0,
      };
    }
  };
  await Promise.all(Array.from({ length: Math.min(WATCH_COUNT_CONCURRENCY, rows.length) }, worker));
  return results;
}

/** Devolve `null` para inexistente ou de outro dono; quem renderiza decide `notFound()`. */
export async function getWatch(id: string): Promise<WatchItem | null> {
  const user = await requireUser();
  const row = await db.watch.findFirst({ where: { id, ownerId: user.id }, select: watchSelect });
  return row ? toWatchItem(row) : null;
}
