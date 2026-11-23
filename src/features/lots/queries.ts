import "server-only";

import { cache } from "react";

import { compareToFixedLimit, roomToFixedLimit } from "@/domain/finance/calculator";
import { estimatePrice, limitFit, type PriceEstimate } from "@/domain/listings/estimates";
import { lotBidSteps } from "@/domain/lots/bid-history";
import { cents } from "@/domain/money";
import { getEstimateContext } from "@/features/listings/queries";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import { toFixedLimit } from "./limit";
import { LOT_GROUPS_PAGE_SIZE, LOT_POSITION_COMPARISONS, type LotFilters, LOTS_PAGE_SIZE } from "./schemas";
import type { FollowedLotsOverview, LotDetail, LotGroupPage, LotListItem, LotPage } from "./types";

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
  // No máximo 1 rascunho por lote, sempre na maior versão (RF-05); as 2 mais recentes cobrem rascunho + última fixada.
  analyses: {
    orderBy: { version: "desc" },
    take: 2,
    select: { id: true, status: true, isViable: true, maxBidCents: true, version: true, fixedAt: true },
  },
  _count: { select: { results: true } },
} satisfies Prisma.LotSelect;

type ListRow = Prisma.LotGetPayload<{ select: typeof listSelect }>;

function toListItem(row: ListRow): LotListItem {
  const latestFixed = row.analyses.find((analysis) => analysis.status === "fixed");
  const openDraft = row.analyses.find((analysis) => analysis.status === "draft");
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
      latestFixed?.isViable != null && latestFixed.fixedAt
        ? {
            isViable: latestFixed.isViable,
            maxBid: latestFixed.maxBidCents === null ? null : cents(latestFixed.maxBidCents),
            version: latestFixed.version,
            fixedAt: latestFixed.fixedAt,
          }
        : null,
    openDraftId: openDraft?.id ?? null,
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
      filters.analysis === "rascunho" ? { analyses: { some: { status: "draft" } } } : {},
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
 * Ids dos lotes na posição pedida (lance × limite). Usado em `listLotsByAuction`, que pagina por leilão no banco.
 */
async function positionWhere(ownerId: string, filters: LotFilters): Promise<Prisma.LotWhereInput> {
  if (!filters.position) return {};
  const rows = await db.lot.findMany({ where: lotWhere(ownerId, filters), select: listSelect });
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
  const where = lotWhere(user.id, filters, scope.auctionId);
  const start = (filters.page - 1) * LOTS_PAGE_SIZE;
  const orderBy: Prisma.LotOrderByWithRelationInput[] =
    filters.sort === "folga"
      ? [{ id: "asc" }]
      : filters.sort === "atualizados"
        ? [{ updatedAt: "desc" }, { id: "asc" }]
        : scope.auctionId
          ? [{ lotNumber: "asc" }, { id: "asc" }]
          : [
              { auction: { startsAt: filters.timing === "proximos" ? "asc" : "desc" } },
              { lotNumber: "asc" },
              { id: "asc" },
            ];

  // Posição e folga dependem da análise fixada mais recente: busca os lotes uma única vez e filtra/ordena aqui.
  if (filters.position || filters.sort === "folga") {
    const rows = await db.lot.findMany({ where, orderBy, select: listSelect });
    let items = rows.map(toListItem);
    if (filters.position) {
      const wanted = LOT_POSITION_COMPARISONS[filters.position];
      items = items.filter((item) => positionOf(item) === wanted);
    }
    if (filters.sort === "folga") items = items.sort(byRoom);
    return {
      items: items.slice(start, start + LOTS_PAGE_SIZE),
      total: items.length,
      page: filters.page,
      pageSize: LOTS_PAGE_SIZE,
    };
  }

  const [rows, total] = await Promise.all([
    db.lot.findMany({ where, orderBy, skip: start, take: LOTS_PAGE_SIZE, select: listSelect }),
    db.lot.count({ where }),
  ]);

  return { items: rows.map(toListItem), total, page: filters.page, pageSize: LOTS_PAGE_SIZE };
}

/**
 * Base compartilhada de lotes acompanhados ativos sem resultado (memo por requisição, D-85):
 * usada diretamente pela sidebar (`FollowedLotsNav`, sem carregar estimativas) e enriquecida por
 * `getFollowedLotsOverview` no dashboard, evitando duas consultas paralelas na mesma requisição.
 */
export const getFollowedLotsBase = cache(async () => {
  const user = await requireUser();
  return db.lot.findMany({
    where: {
      ownerId: user.id,
      archivedAt: null,
      auction: { archivedAt: null },
      isFollowed: true,
      results: { none: {} },
    },
    orderBy: [{ auction: { startsAt: "asc" } }, { lotNumber: "asc" }, { id: "asc" }],
    select: {
      ...listSelect,
      listing: {
        select: {
          status: true,
          endsAt: true,
          mileageKm: true,
          category: true,
          damageLevel: true,
          fipeCode: true,
          marketValueFipeCode: true,
          vehicleOrigin: true,
          marketValueCents: true,
        },
      },
    },
  });
});

/**
 * Acompanhados do dashboard (D-44): ativos, marcados e sem resultado, do que encerra primeiro (sem anúncio ou sem
 * data, por último, pela data do leilão). Cada um com o provável do anúncio aberto ligado frente ao limite fixado.
 * Memo por requisição: o cabeçalho conta os que têm o provável acima do limite.
 */
export const getFollowedLotsOverview = cache(async (): Promise<FollowedLotsOverview> => {
  await requireUser();
  const [rows, context] = await Promise.all([getFollowedLotsBase(), getEstimateContext()]);

  const items = rows.map(({ listing, ...row }) => {
    const item = toListItem(row);
    const open = listing?.status === "open" && (listing.endsAt === null || listing.endsAt > context.now);
    const price =
      listing && open
        ? estimatePrice(
            {
              brand: item.brand,
              model: item.model,
              modelYear: item.modelYear,
              mileageKm: listing.mileageKm,
              category: listing.category,
              damageLevel: listing.damageLevel,
              fipeCode: listing.fipeCode ?? listing.marketValueFipeCode,
              origin: listing.vehicleOrigin,
              marketValue: listing.marketValueCents === null ? null : cents(listing.marketValueCents),
            },
            context.index,
          )
        : null;
    const maxBid = item.limit?.isViable ? item.limit.maxBid : null;
    return {
      ...item,
      endsAt: listing?.endsAt ?? null,
      price,
      fit: price === null ? null : limitFit(price, maxBid),
    };
  });
  // Estável: sem data de fim, mantém a ordem do banco (data do leilão).
  items.sort((a, b) => {
    if (a.endsAt === null || b.endsAt === null) return a.endsAt === b.endsAt ? 0 : a.endsAt === null ? 1 : -1;
    return a.endsAt.getTime() - b.endsAt.getTime();
  });

  return { items, aboveLimit: items.filter((item) => item.fit === "above").length, now: context.now };
});

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
      listing: {
        select: {
          lastCheckedAt: true,
          source: { select: { name: true } },
          status: true,
          endsAt: true,
          mileageKm: true,
          category: true,
          damageLevel: true,
          fipeCode: true,
          marketValueFipeCode: true,
          vehicleOrigin: true,
          marketValueCents: true,
          marketValueOrigin: true,
          marketValueRefMonth: true,
          observations: {
            where: { bidCents: { gt: 0 } },
            orderBy: { observedAt: "asc" },
            select: { observedAt: true, bidCents: true },
          },
        },
      },
      _count: { select: { results: true, analyses: { where: { status: "fixed" } } } },
    },
  });
  if (!row) return null;

  const item = toListItem(row);
  const { listing } = row;
  const marketValue = listing?.marketValueCents == null ? null : cents(listing.marketValueCents);
  let price: PriceEstimate | null = null;
  if (listing?.status === "open" && (listing.endsAt === null || listing.endsAt > new Date())) {
    const context = await getEstimateContext();
    price = estimatePrice(
      {
        brand: item.brand,
        model: item.model,
        modelYear: item.modelYear,
        mileageKm: listing.mileageKm,
        category: listing.category,
        damageLevel: listing.damageLevel,
        fipeCode: listing.fipeCode ?? listing.marketValueFipeCode,
        origin: listing.vehicleOrigin,
        marketValue,
      },
      context.index,
    );
  }
  const maxBid = item.limit?.isViable ? item.limit.maxBid : null;

  return {
    ...item,
    manufactureYear: row.manufactureYear,
    mileageKm: row.mileageKm,
    startingBid: row.startingBidCents === null ? null : cents(row.startingBidCents),
    lotUrl: row.lotUrl,
    notes: row.notes,
    fixedAnalysisCount: row._count.analyses,
    resultCount: row._count.results,
    updatedAt: row.updatedAt,
    tracking: listing && {
      sourceName: listing.source.name,
      lastCheckedAt: listing.lastCheckedAt,
      endsAt: listing.endsAt,
      market:
        marketValue === null || listing.marketValueOrigin === null
          ? null
          : { value: marketValue, origin: listing.marketValueOrigin, refMonth: listing.marketValueRefMonth },
      price,
      fit: price === null ? null : limitFit(price, maxBid),
      bidSteps: lotBidSteps(
        listing.observations.flatMap((observation) =>
          observation.bidCents === null
            ? []
            : [{ observedAt: observation.observedAt, bid: cents(observation.bidCents) }],
        ),
      ),
    },
  };
}
