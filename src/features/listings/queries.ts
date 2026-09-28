import "server-only";

import type { DamageLevel } from "@/domain/listings/condition";
import {
  CATEGORY_GROUPS,
  type CategoryKey,
  CONDITION_RULES,
  type ConditionKey,
  DEFAULT_CATEGORY,
  type ListingCriteria,
  searchTokens,
} from "@/domain/listings/criteria";
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

/** Campos do cartão de anúncio; reusado pelos alertas. */
export const listingCardSelect = {
  id: true,
  url: true,
  lotNumber: true,
  title: true,
  modelYear: true,
  mileageKm: true,
  fuel: true,
  recoveryType: true,
  damageLevel: true,
  conditionFlags: true,
  inspectionResult: true,
  inspectionNotes: true,
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

type ListingCardRow = Prisma.ListingGetPayload<{ select: typeof listingCardSelect }>;

const toCents = (value: number | null) => (value === null ? null : cents(value));

export function toListItem(row: ListingCardRow): ListingListItem {
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
    damageLevel: row.damageLevel,
    conditionFlags: row.conditionFlags,
    inspection: row.inspectionResult,
    inspectionNotes: row.inspectionNotes,
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

function categoryWhere(key: CategoryKey): Prisma.ListingWhereInput {
  const categories = CATEGORY_GROUPS[key];
  return categories === null ? {} : { category: { in: [...categories] } };
}

function conditionWhere(key: ConditionKey): Prisma.ListingWhereInput {
  const rule = CONDITION_RULES[key];
  if (rule === null) return {};
  const levels: readonly DamageLevel[] = rule.levels;
  return {
    OR: [
      ...(rule.unclassified ? [{ damageLevel: null }] : []),
      ...(levels.length > 0 ? [{ damageLevel: { in: [...levels] } }] : []),
    ],
  };
}

/** Cada palavra da busca precisa aparecer em algum dos campos (`searchTokens`, mesma regra dos monitores). */
function searchWhere(search: string | null): Prisma.ListingWhereInput {
  return {
    AND: searchTokens(search).map((token) => ({
      OR: [
        { title: { contains: token, mode: "insensitive" } },
        { brand: { contains: token, mode: "insensitive" } },
        { model: { contains: token, mode: "insensitive" } },
        { fipeName: { contains: token, mode: "insensitive" } },
      ],
    })),
  };
}

/** Aberto de fato: situação aberta e fim ainda no futuro (ou desconhecido). Mesma regra de `isOpenAt`. */
function openWhere(now: Date): Prisma.ListingWhereInput {
  return { status: "open", OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
}

/** Critérios no banco, exceto a distância exata (o retângulo só pré-filtra; `withinRadius` completa). */
function criteriaWhere(criteria: ListingCriteria): Prisma.ListingWhereInput {
  return {
    AND: [
      withinBox(criteria.radiusKm),
      categoryWhere(criteria.category),
      conditionWhere(criteria.condition),
      searchWhere(criteria.search),
      criteria.yearFrom === null ? {} : { modelYear: { gte: criteria.yearFrom } },
      criteria.yearTo === null ? {} : { modelYear: { lte: criteria.yearTo } },
      criteria.maxPrice === null
        ? {}
        : {
            OR: [
              { currentBidCents: { lte: criteria.maxPrice } },
              { currentBidCents: null, minimumBidCents: { lte: criteria.maxPrice } },
            ],
          },
    ],
  };
}

const withinRadius = (radiusKm: number | null) => (item: { distanceKm: number | null }) =>
  radiusKm === null || (item.distanceKm !== null && item.distanceKm <= radiusKm);

export async function listListings(filters: ListingFilters): Promise<ListingPage> {
  await requireUser();
  const now = new Date();
  const criteria: ListingCriteria = {
    search: filters.search ?? null,
    yearFrom: filters.yearFrom ?? null,
    yearTo: filters.yearTo ?? null,
    maxPrice: filters.maxPrice ?? null,
    radiusKm: filters.distanceKm,
    category: filters.category,
    condition: filters.condition,
  };
  const where: Prisma.ListingWhereInput = {
    AND: [filters.ended ? { NOT: openWhere(now) } : openWhere(now), criteriaWhere(criteria)],
  };

  // Abertos: o que encerra primeiro. Encerrados: o mais recente.
  const orderBy: Prisma.ListingOrderByWithRelationInput[] = [{ endsAt: filters.ended ? "desc" : "asc" }, { id: "asc" }];
  const start = (filters.page - 1) * LISTINGS_PAGE_SIZE;
  const radius = filters.distanceKm;

  // Sem raio, tudo é filtrável no banco: pagina lá.
  if (radius === null) {
    const [rows, total] = await Promise.all([
      db.listing.findMany({ where, orderBy, skip: start, take: LISTINGS_PAGE_SIZE, select: listingCardSelect }),
      db.listing.count({ where }),
    ]);
    return { items: rows.map(toListItem), total, page: filters.page, pageSize: LISTINGS_PAGE_SIZE, truncated: false };
  }

  // Com raio, o retângulo corta no banco e a distância exata filtra aqui, sobre no máximo MAX_CANDIDATES.
  const rows = await db.listing.findMany({ where, orderBy, take: MAX_CANDIDATES + 1, select: listingCardSelect });
  const truncated = rows.length > MAX_CANDIDATES;
  const items = rows.slice(0, MAX_CANDIDATES).map(toListItem).filter(withinRadius(radius));

  return {
    items: items.slice(start, start + LISTINGS_PAGE_SIZE),
    total: items.length,
    page: filters.page,
    pageSize: LISTINGS_PAGE_SIZE,
    truncated,
  };
}

/** Quantos anúncios abertos atendem aos critérios agora (ex.: "12 lotes combinam com este monitor"). */
export async function countOpenListings(criteria: ListingCriteria): Promise<{ count: number; truncated: boolean }> {
  await requireUser();
  const where: Prisma.ListingWhereInput = { AND: [openWhere(new Date()), criteriaWhere(criteria)] };
  if (criteria.radiusKm === null) return { count: await db.listing.count({ where }), truncated: false };

  const rows = await db.listing.findMany({
    where,
    take: MAX_CANDIDATES + 1,
    select: { municipality: { select: { latitude: true, longitude: true } } },
  });
  const count = rows
    .slice(0, MAX_CANDIDATES)
    .map(({ municipality }) => ({
      distanceKm: municipality ? distanceKm(DEFAULT_REGION.center, municipality) : null,
    }))
    .filter(withinRadius(criteria.radiusKm)).length;
  return { count, truncated: rows.length > MAX_CANDIDATES };
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
      where: { AND: [openWhere(now), withinBox(DEFAULT_REGION.radiusKm), categoryWhere(DEFAULT_CATEGORY)] },
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
