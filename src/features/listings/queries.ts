import "server-only";

import { boundingBox, distanceKm } from "@/domain/listings/geo";
import { collectorHealth } from "@/domain/listings/health";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { cents } from "@/domain/money";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import { type ListingFilters, LISTINGS_PAGE_SIZE } from "./schemas";
import type { CollectorStatus, ListingListItem, ListingPage } from "./types";

/**
 * Catálogo global (D-25): exige sessão, mas não filtra por dono, porque o anúncio é público e igual para todos.
 * O que é do usuário (monitores, alertas, lotes) continua filtrado por `ownerId` nas outras features.
 */

/** Teto de candidatos lidos antes do filtro exato de distância: o retângulo já corta quase tudo. */
const MAX_CANDIDATES = 2_000;

const listSelect = {
  id: true,
  url: true,
  lotNumber: true,
  title: true,
  modelYear: true,
  mileageKm: true,
  fuel: true,
  recoveryType: true,
  city: true,
  state: true,
  auctionName: true,
  endsAt: true,
  status: true,
  currentBidCents: true,
  minimumBidCents: true,
  bidCount: true,
  finalBidCents: true,
  marketValueCents: true,
  photoUrls: true,
  source: { select: { name: true } },
  municipality: { select: { latitude: true, longitude: true } },
} satisfies Prisma.ListingSelect;

type ListRow = Prisma.ListingGetPayload<{ select: typeof listSelect }>;

const toCents = (value: number | null) => (value === null ? null : cents(value));

function toListItem(row: ListRow): ListingListItem {
  return {
    id: row.id,
    sourceName: row.source.name,
    url: row.url,
    lotNumber: row.lotNumber,
    title: row.title,
    modelYear: row.modelYear,
    mileageKm: row.mileageKm,
    fuel: row.fuel,
    recoveryType: row.recoveryType,
    city: row.city,
    state: row.state,
    distanceKm: row.municipality ? distanceKm(DEFAULT_REGION.center, row.municipality) : null,
    auctionName: row.auctionName,
    endsAt: row.endsAt,
    status: row.status,
    currentBid: toCents(row.currentBidCents),
    minimumBid: toCents(row.minimumBidCents),
    bidCount: row.bidCount,
    finalBid: toCents(row.finalBidCents),
    marketValue: toCents(row.marketValueCents),
    photoUrl: row.photoUrls[0] ?? null,
  };
}

/** Pré-filtro de distância no banco (retângulo sobre as coordenadas do município). */
function withinBox(radiusKm: number | null): Prisma.ListingWhereInput {
  if (radiusKm === null) return {};
  const box = boundingBox(DEFAULT_REGION.center, radiusKm);
  return {
    municipality: {
      latitude: { gte: box.minLatitude, lte: box.maxLatitude },
      longitude: { gte: box.minLongitude, lte: box.maxLongitude },
    },
  };
}

/** Aberto de fato: situação aberta e fim ainda no futuro (ou desconhecido). */
function openWhere(now: Date): Prisma.ListingWhereInput {
  return { status: "open", OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
}

export async function listListings(filters: ListingFilters): Promise<ListingPage> {
  await requireUser();
  const now = new Date();
  const search = filters.search;

  const where: Prisma.ListingWhereInput = {
    AND: [
      filters.ended ? { NOT: openWhere(now) } : openWhere(now),
      withinBox(filters.distanceKm),
      search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { brand: { contains: search, mode: "insensitive" } },
              { model: { contains: search, mode: "insensitive" } },
              { fipeName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
      filters.yearFrom ? { modelYear: { gte: filters.yearFrom } } : {},
      filters.yearTo ? { modelYear: { lte: filters.yearTo } } : {},
      filters.maxPrice
        ? {
            OR: [
              { currentBidCents: { lte: filters.maxPrice } },
              { currentBidCents: null, minimumBidCents: { lte: filters.maxPrice } },
            ],
          }
        : {},
    ],
  };

  // Abertos: o que encerra primeiro. Encerrados: o mais recente.
  const orderBy: Prisma.ListingOrderByWithRelationInput[] = [{ endsAt: filters.ended ? "desc" : "asc" }, { id: "asc" }];
  const start = (filters.page - 1) * LISTINGS_PAGE_SIZE;
  const radius = filters.distanceKm;

  // Sem raio, tudo é filtrável no banco: pagina lá.
  if (radius === null) {
    const [rows, total] = await Promise.all([
      db.listing.findMany({ where, orderBy, skip: start, take: LISTINGS_PAGE_SIZE, select: listSelect }),
      db.listing.count({ where }),
    ]);
    return { items: rows.map(toListItem), total, page: filters.page, pageSize: LISTINGS_PAGE_SIZE, truncated: false };
  }

  // Com raio, o retângulo corta no banco e a distância exata filtra aqui, sobre no máximo MAX_CANDIDATES.
  const rows = await db.listing.findMany({ where, orderBy, take: MAX_CANDIDATES + 1, select: listSelect });
  const truncated = rows.length > MAX_CANDIDATES;
  const items = rows
    .slice(0, MAX_CANDIDATES)
    .map(toListItem)
    .filter((item) => item.distanceKm !== null && item.distanceKm <= radius);

  return {
    items: items.slice(start, start + LISTINGS_PAGE_SIZE),
    total: items.length,
    page: filters.page,
    pageSize: LISTINGS_PAGE_SIZE,
    truncated,
  };
}

/** Saúde do coletor para o dashboard e para "Descobertos": última execução e abertos na região. */
export async function getCollectorStatus(): Promise<CollectorStatus> {
  await requireUser();
  const now = new Date();

  const [lastRun, openCandidates] = await Promise.all([
    db.collectorRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: {
        status: true,
        startedAt: true,
        finishedAt: true,
        created: true,
        failed: true,
        source: { select: { name: true } },
      },
    }),
    db.listing.findMany({
      where: { AND: [openWhere(now), withinBox(DEFAULT_REGION.radiusKm)] },
      select: { municipality: { select: { latitude: true, longitude: true } } },
      take: MAX_CANDIDATES,
    }),
  ]);

  const openInRegion = openCandidates.filter(
    ({ municipality }) =>
      municipality !== null && distanceKm(DEFAULT_REGION.center, municipality) <= DEFAULT_REGION.radiusKm,
  ).length;

  return {
    health: collectorHealth(lastRun, now),
    lastRun: lastRun && {
      sourceName: lastRun.source.name,
      status: lastRun.status,
      startedAt: lastRun.startedAt,
      finishedAt: lastRun.finishedAt,
      created: lastRun.created,
      failed: lastRun.failed,
    },
    openInRegion,
    regionLabel: DEFAULT_REGION.label,
    radiusKm: DEFAULT_REGION.radiusKm,
  };
}
