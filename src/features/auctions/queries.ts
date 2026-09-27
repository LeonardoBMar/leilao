import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { toZonedDateTimeInput, zonedStartOfDay } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import { type AuctionFilters, AUCTIONS_PAGE_SIZE, periodRange } from "./schemas";
import type { AuctionDetail, AuctionListItem, AuctionPage } from "./types";

const activeLotCount = { _count: { select: { lots: { where: { archivedAt: null } } } } } as const;

const listSelect = {
  id: true,
  name: true,
  auctioneer: true,
  origin: true,
  status: true,
  startsAt: true,
  archivedAt: true,
  ...activeLotCount,
} satisfies Prisma.AuctionSelect;

export async function listAuctions(filters: AuctionFilters): Promise<AuctionPage> {
  const user = await requireUser();
  const range = periodRange(filters);

  const where: Prisma.AuctionWhereInput = {
    ownerId: user.id,
    archivedAt: filters.archived ? { not: null } : null,
    ...(filters.origin ? { origin: filters.origin } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(range.gte || range.lt ? { startsAt: range } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { auctioneer: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.auction.findMany({
      where,
      orderBy: [{ startsAt: filters.sort }, { id: filters.sort }],
      skip: (filters.page - 1) * AUCTIONS_PAGE_SIZE,
      take: AUCTIONS_PAGE_SIZE,
      select: listSelect,
    }),
    db.auction.count({ where }),
  ]);

  return {
    items: rows.map(({ _count, ...row }) => ({ ...row, lotCount: _count.lots })),
    total,
    page: filters.page,
    pageSize: AUCTIONS_PAGE_SIZE,
  };
}

/** `null` para inexistente ou de outro dono; quem renderiza decide `notFound()`. */
export async function getAuction(id: string): Promise<AuctionDetail | null> {
  const user = await requireUser();
  const row = await db.auction.findFirst({
    where: { id, ownerId: user.id },
    select: {
      ...listSelect,
      city: true,
      state: true,
      noticeUrl: true,
      platformUrl: true,
      notes: true,
      updatedAt: true,
    },
  });
  if (!row) return null;

  const totalLotCount = await db.lot.count({ where: { auctionId: id, ownerId: user.id } });
  const { _count, ...auction } = row;
  return { ...auction, lotCount: _count.lots, totalLotCount };
}

/**
 * Próximos leilões do dashboard (SPEC §5): ativos, sem cancelados e encerrados, a partir do início de hoje
 * no horário de Brasília (o status é manual, então "em andamento" aparece mesmo com data passada).
 */
export async function listUpcomingAuctions(limit = 5): Promise<AuctionListItem[]> {
  const user = await requireUser();
  const today = zonedStartOfDay(toZonedDateTimeInput(new Date()).slice(0, 10));

  const rows = await db.auction.findMany({
    where: {
      ownerId: user.id,
      archivedAt: null,
      OR: [{ status: "in_progress" }, { status: "scheduled", ...(today ? { startsAt: { gte: today } } : {}) }],
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: limit,
    select: listSelect,
  });
  return rows.map(({ _count, ...row }) => ({ ...row, lotCount: _count.lots }));
}
