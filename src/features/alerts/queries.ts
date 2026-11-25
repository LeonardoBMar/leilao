import "server-only";

import { cache } from "react";

import { type EstimateContext, getEstimateContext, listingCardSelect, toListItem } from "@/features/listings/queries";
import { toWatchItem, watchSelect } from "@/features/watches/queries";
import type { Prisma } from "@/generated/prisma/client";
import { watchTitle } from "@/lib/watch-summary";
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

function toAlertItem(row: AlertRow, estimates: EstimateContext | null): AlertItem {
  const watch = toWatchItem(row.watch);
  return {
    id: row.id,
    createdAt: row.createdAt,
    readAt: row.readAt,
    watchId: watch.id,
    watchTitle: watchTitle(watch.name, watch.criteria),
    listing: toListItem(row.listing, estimates),
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
  // A base das estimativas só é lida quando há cartões para mostrar.
  const estimates = rows.length > 0 ? await getEstimateContext() : null;

  const watchItem = watch ? toWatchItem(watch) : null;
  return {
    items: rows.map((row) => toAlertItem(row, estimates)),
    total,
    unread,
    page: filters.page,
    pageSize: ALERTS_PAGE_SIZE,
    watchTitle: watchItem ? watchTitle(watchItem.name, watchItem.criteria) : null,
  };
}

/** Não lidos, para o contador da navegação e faixa do dashboard (memo por requisição). */
export const countUnreadAlerts = cache(async (): Promise<number> => {
  const user = await requireUser();
  return db.alert.count({ where: { ownerId: user.id, readAt: null } });
});

export type RecentUnreadAlert = {
  id: string;
  title: string;
  trackedLotId: string | null;
};

/**
 * Os não lidos mais recentes, para o dashboard (D-85): seleção mínima (sem fotos, watch nem base de estimativas)
 * compartilhando a contagem de `countUnreadAlerts` na mesma requisição.
 */
export async function listRecentUnreadAlerts(limit: number): Promise<{ items: RecentUnreadAlert[]; total: number }> {
  const user = await requireUser();
  const [rows, total] = await Promise.all([
    db.alert.findMany({
      where: { ownerId: user.id, readAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        listing: {
          select: {
            title: true,
            lots: { where: { ownerId: user.id }, select: { id: true }, take: 1 },
          },
        },
      },
    }),
    countUnreadAlerts(),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.listing.title,
      trackedLotId: row.listing.lots[0]?.id ?? null,
    })),
    total,
  };
}
