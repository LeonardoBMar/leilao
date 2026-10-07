import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { toZonedDateTimeInput, zonedStartOfDay } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { AuctionDetail, AuctionListItem } from "./types";

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
      sourceId: true,
      externalId: true,
    },
  });
  if (!row) return null;

  const totalLotCount = await db.lot.count({ where: { auctionId: id, ownerId: user.id } });
  const { _count, sourceId, externalId, ...auction } = row;
  return {
    ...auction,
    lotCount: _count.lots,
    totalLotCount,
    catalog: sourceId !== null && externalId !== null ? { sourceId, externalId } : null,
  };
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
