import "server-only";

import { listingCardSelect, toListItem } from "@/features/listings/queries";
import { toWatchItem, watchSelect } from "@/features/watches/queries";
import { watchTitle } from "@/features/watches/summary";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import { type AlertFilters, ALERTS_PAGE_SIZE } from "./schemas";
import type { AlertItem, AlertPage } from "./types";

const alertSelect = (ownerId: string) =>
  ({
    id: true,
    createdAt: true,
    readAt: true,
    watch: { select: watchSelect },
    listing: { select: listingCardSelect(ownerId) },
  }) satisfies Prisma.AlertSelect;

type AlertRow = Prisma.AlertGetPayload<{ select: ReturnType<typeof alertSelect> }>;

function toAlertItem(row: AlertRow): AlertItem {
  const watch = toWatchItem(row.watch);
  return {
    id: row.id,
    createdAt: row.createdAt,
    readAt: row.readAt,
    watchId: watch.id,
    watchTitle: watchTitle(watch.name, watch.criteria),
    listing: toListItem(row.listing),
  };
}

/** Alertas do usuário, do mais novo para o mais antigo. */
export async function listAlerts(filters: AlertFilters): Promise<AlertPage> {
  const user = await requireUser();
  const scope: Prisma.AlertWhereInput = { ownerId: user.id, ...(filters.watchId ? { watchId: filters.watchId } : {}) };
  const where: Prisma.AlertWhereInput = { ...scope, ...(filters.unreadOnly ? { readAt: null } : {}) };

  const [rows, total, unread, watch] = await Promise.all([
    db.alert.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * ALERTS_PAGE_SIZE,
      take: ALERTS_PAGE_SIZE,
      select: alertSelect(user.id),
    }),
    db.alert.count({ where }),
    db.alert.count({ where: { ...scope, readAt: null } }),
    filters.watchId
      ? db.watch.findFirst({ where: { id: filters.watchId, ownerId: user.id }, select: watchSelect })
      : null,
  ]);

  const watchItem = watch ? toWatchItem(watch) : null;
  return {
    items: rows.map(toAlertItem),
    total,
    unread,
    page: filters.page,
    pageSize: ALERTS_PAGE_SIZE,
    watchTitle: watchItem ? watchTitle(watchItem.name, watchItem.criteria) : null,
  };
}

/** Não lidos, para o contador da navegação. */
export async function countUnreadAlerts(): Promise<number> {
  const user = await requireUser();
  return db.alert.count({ where: { ownerId: user.id, readAt: null } });
}

/** Os não lidos mais recentes, para o dashboard. */
export async function listRecentUnreadAlerts(limit: number): Promise<{ items: AlertItem[]; total: number }> {
  const user = await requireUser();
  const where: Prisma.AlertWhereInput = { ownerId: user.id, readAt: null };
  const [rows, total] = await Promise.all([
    db.alert.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: alertSelect(user.id),
    }),
    db.alert.count({ where }),
  ]);
  return { items: rows.map(toAlertItem), total };
}
