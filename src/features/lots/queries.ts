import "server-only";

import { compareToFixedLimit, roomToFixedLimit } from "@/domain/finance/calculator";
import { cents } from "@/domain/money";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import { toFixedLimit } from "./limit";
import { LOT_GROUPS_PAGE_SIZE, LOT_POSITION_COMPARISONS, type LotFilters, LOTS_PAGE_SIZE } from "./schemas";
import type { LotDetail, LotGroupPage, LotListItem, LotPage } from "./types";

const listSelect = {
  id: true,
  lotNumber: true,
  brand: true,
  model: true,
  vehicleVersion: true,
  modelYear: true,
  isFollowed: true,
  currentBidCents: true,
  currentBidObservedAt: true,
  archivedAt: true,
  auction: { select: { id: true, name: true, startsAt: true, archivedAt: true } },
  // Limite da análise fixada mais recente (a análise só vira histórico, nunca é sobrescrita).
  analyses: {
    where: { status: "fixed" },
    orderBy: { version: "desc" },
    take: 1,
    select: { isViable: true, maxBidCents: true, version: true, fixedAt: true },
  },
  _count: { select: { results: true } },
} satisfies Prisma.LotSelect;

type ListRow = Prisma.LotGetPayload<{ select: typeof listSelect }>;

function toListItem(row: ListRow): LotListItem {
  const [latest] = row.analyses;
  return {
    id: row.id,
    lotNumber: row.lotNumber,
    brand: row.brand,
    model: row.model,
    vehicleVersion: row.vehicleVersion,
    modelYear: row.modelYear,
    isFollowed: row.isFollowed,
    currentBid: row.currentBidCents === null ? null : cents(row.currentBidCents),
    currentBidObservedAt: row.currentBidObservedAt,
    archivedAt: row.archivedAt,
    auction: row.auction,
    limit:
      latest?.isViable != null && latest.fixedAt
        ? {
            isViable: latest.isViable,
            maxBid: latest.maxBidCents === null ? null : cents(latest.maxBidCents),
            version: latest.version,
            fixedAt: latest.fixedAt,
          }
        : null,
    hasResult: row._count.results > 0,
  };
}

/**
 * Lotes do usuário que atendem aos filtros. Com `auctionId`, os daquele leilão (inclusive de leilão arquivado, para
 * consulta). Sem `auctionId`, a visão global: ativos = lote e leilão não arquivados (RF-08).
 */
function lotWhere(ownerId: string, filters: LotFilters, auctionId?: string, now = new Date()): Prisma.LotWhereInput {
  const archivedScope: Prisma.LotWhereInput = auctionId
    ? { auctionId, archivedAt: filters.archived ? { not: null } : null }
    : filters.archived
      ? { OR: [{ archivedAt: { not: null } }, { auction: { archivedAt: { not: null } } }] }
      : { archivedAt: null, auction: { archivedAt: null } };

  return {
    AND: [
      { ownerId },
      archivedScope,
      filters.followedOnly ? { isFollowed: true } : {},
      filters.analysis === "com" ? { analyses: { some: { status: "fixed" } } } : {},
      filters.analysis === "sem" ? { analyses: { none: { status: "fixed" } } } : {},
      filters.result === "com" ? { results: { some: {} } } : {},
      filters.result === "sem" ? { results: { none: {} } } : {},
      filters.timing === "proximos" ? { auction: { startsAt: { gte: now } } } : {},
      filters.timing === "realizados" ? { auction: { startsAt: { lt: now } } } : {},
      filters.search
        ? {
            OR: [
              { lotNumber: { contains: filters.search, mode: "insensitive" } },
              { brand: { contains: filters.search, mode: "insensitive" } },
              { model: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };
}

/** Lance × limite do lote: a mesma comparação da tela (`compareToFixedLimit`). */
const positionOf = (item: LotListItem) => compareToFixedLimit(toFixedLimit(item.limit), item.currentBid);

/** Maior folga primeiro; sem folga calculável (sem limite viável ou sem lance) por último. */
function byRoom(a: LotListItem, b: LotListItem): number {
  const roomA = roomToFixedLimit(toFixedLimit(a.limit), a.currentBid);
  const roomB = roomToFixedLimit(toFixedLimit(b.limit), b.currentBid);
  if (roomA === null || roomB === null) return roomA === roomB ? 0 : roomA === null ? 1 : -1;
  return roomB - roomA;
}

/**
 * Ids dos lotes na posição pedida (lance × limite). A posição depende da análise fixada mais recente, então é
 * calculada aqui sobre os lotes do usuário que atendem aos outros filtros (poucas centenas), e volta ao banco como
 * `id in`. Sem filtro de posição: `null`.
 */
async function positionWhere(ownerId: string, filters: LotFilters, auctionId?: string): Promise<Prisma.LotWhereInput> {
  if (!filters.position) return {};
  const rows = await db.lot.findMany({ where: lotWhere(ownerId, filters, auctionId), select: listSelect });
  const wanted = LOT_POSITION_COMPARISONS[filters.position];
  return {
    id: {
      in: rows
        .map(toListItem)
        .filter((item) => positionOf(item) === wanted)
        .map((item) => item.id),
    },
  };
}

/** Lista paginada de lotes (ver `lotWhere`). */
export async function listLots(filters: LotFilters, scope: { auctionId?: string } = {}): Promise<LotPage> {
  const user = await requireUser();
  const where: Prisma.LotWhereInput = {
    AND: [lotWhere(user.id, filters, scope.auctionId), await positionWhere(user.id, filters, scope.auctionId)],
  };
  const start = (filters.page - 1) * LOTS_PAGE_SIZE;

  // Folga depende da análise fixada: ordena aqui, sobre os lotes do usuário no filtro.
  if (filters.sort === "folga") {
    const rows = await db.lot.findMany({ where, orderBy: [{ id: "asc" }], select: listSelect });
    const items = rows.map(toListItem).sort(byRoom);
    return {
      items: items.slice(start, start + LOTS_PAGE_SIZE),
      total: items.length,
      page: filters.page,
      pageSize: LOTS_PAGE_SIZE,
    };
  }

  const orderBy: Prisma.LotOrderByWithRelationInput[] =
    filters.sort === "atualizados"
      ? [{ updatedAt: "desc" }, { id: "asc" }]
      : scope.auctionId
        ? [{ lotNumber: "asc" }, { id: "asc" }]
        : [
            { auction: { startsAt: filters.timing === "proximos" ? "asc" : "desc" } },
            { lotNumber: "asc" },
            { id: "asc" },
          ];

  const [rows, total] = await Promise.all([
    db.lot.findMany({ where, orderBy, skip: start, take: LOTS_PAGE_SIZE, select: listSelect }),
    db.lot.count({ where }),
  ]);

  return { items: rows.map(toListItem), total, page: filters.page, pageSize: LOTS_PAGE_SIZE };
}

/**
 * "Minhas análises" por leilão (D-42): os leilões do usuário, do mais recente, cada um com os lotes que atendem aos
 * filtros. Sem filtro de lote, aparecem também os leilões ainda sem lote. Paginada por leilão.
 */
export async function listLotsByAuction(filters: LotFilters): Promise<LotGroupPage> {
  const user = await requireUser();
  const lots: Prisma.LotWhereInput = { AND: [lotWhere(user.id, filters), await positionWhere(user.id, filters)] };
  const hasLotFilters = Boolean(
    filters.search || filters.followedOnly || filters.analysis || filters.result || filters.position || filters.timing,
  );
  const where: Prisma.AuctionWhereInput = {
    AND: [
      { ownerId: user.id },
      filters.archived
        ? { OR: [{ archivedAt: { not: null } }, { lots: { some: { archivedAt: { not: null } } } }] }
        : { archivedAt: null },
      hasLotFilters ? { lots: { some: lots } } : {},
    ],
  };

  const [rows, total] = await Promise.all([
    db.auction.findMany({
      where,
      // Próximos: o mais perto primeiro. Senão, o mais recente.
      orderBy: [{ startsAt: filters.timing === "proximos" ? "asc" : "desc" }, { id: "asc" }],
      skip: (filters.page - 1) * LOT_GROUPS_PAGE_SIZE,
      take: LOT_GROUPS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        auctioneer: true,
        startsAt: true,
        archivedAt: true,
        sourceId: true,
        externalId: true,
        lots: { where: lots, orderBy: [{ lotNumber: "asc" }, { id: "asc" }], select: listSelect },
      },
    }),
    db.auction.count({ where }),
  ]);

  // Total de lotes no catálogo dos leilões vindos de uma fonte ("214 no catálogo").
  const keys = rows.flatMap(({ sourceId, externalId }) =>
    sourceId !== null && externalId !== null ? [{ sourceId, auctionExternalId: externalId }] : [],
  );
  const catalog =
    keys.length === 0
      ? []
      : await db.listing.groupBy({
          by: ["sourceId", "auctionExternalId"],
          where: { OR: keys },
          _count: { _all: true },
        });
  const catalogTotal = (sourceId: string, externalId: string) =>
    catalog.find((group) => group.sourceId === sourceId && group.auctionExternalId === externalId)?._count._all ?? 0;

  return {
    groups: rows.map(({ lots: lotRows, sourceId, externalId, ...auction }) => ({
      auction: {
        ...auction,
        catalog:
          sourceId !== null && externalId !== null
            ? { sourceId, externalId, total: catalogTotal(sourceId, externalId) }
            : null,
      },
      lots: lotRows.map(toListItem),
    })),
    total,
    page: filters.page,
    pageSize: LOT_GROUPS_PAGE_SIZE,
  };
}

/** `null` para inexistente ou de outro dono; quem renderiza decide `notFound()`. */
export async function getLot(id: string): Promise<LotDetail | null> {
  const user = await requireUser();
  const row = await db.lot.findFirst({
    where: { id, ownerId: user.id },
    select: {
      ...listSelect,
      manufactureYear: true,
      mileageKm: true,
      startingBidCents: true,
      lotUrl: true,
      notes: true,
      updatedAt: true,
      listing: { select: { lastCheckedAt: true, source: { select: { name: true } } } },
      _count: { select: { results: true, analyses: { where: { status: "fixed" } } } },
    },
  });
  if (!row) return null;

  return {
    ...toListItem(row),
    manufactureYear: row.manufactureYear,
    mileageKm: row.mileageKm,
    startingBid: row.startingBidCents === null ? null : cents(row.startingBidCents),
    lotUrl: row.lotUrl,
    notes: row.notes,
    fixedAnalysisCount: row._count.analyses,
    resultCount: row._count.results,
    updatedAt: row.updatedAt,
    tracking: row.listing && { sourceName: row.listing.source.name, lastCheckedAt: row.listing.lastCheckedAt },
  };
}
