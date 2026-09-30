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
import {
  type AnalysisSample,
  buildEstimateIndex,
  type EstimateIndex,
  estimateLimit,
  estimatePrice,
  SALES_WINDOW_MS,
} from "@/domain/listings/estimates";
import { boundingBox, distanceKm } from "@/domain/listings/geo";
import { collectorHealth } from "@/domain/listings/health";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { trackerMissing } from "@/domain/listings/tracker";
import { cents } from "@/domain/money";
import { analysisColumns, toInputs } from "@/features/analyses/queries";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import { type ListingFilters, LISTINGS_PAGE_SIZE } from "./schemas";
import type { CollectorStatus, ListingEstimate, ListingListItem, ListingPage } from "./types";

/**
 * Catálogo global (D-25): exige sessão, mas não filtra por dono, porque o anúncio é público e igual para todos.
 * O que é do usuário (monitores, alertas, lotes) continua filtrado por `ownerId` nas outras features.
 */

/** Teto de candidatos lidos antes do filtro exato de distância: o retângulo já corta quase tudo. */
const MAX_CANDIDATES = 2_000;

/** Campos do cartão de anúncio; reusado pelos alertas. Traz o lote do usuário ligado ao anúncio, se houver. */
export const listingCardSelect = (ownerId: string) =>
  ({
    id: true,
    url: true,
    lotNumber: true,
    title: true,
    brand: true,
    model: true,
    auctionExternalId: true,
    auctionStartsAt: true,
    startsAt: true,
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
    category: true,
    photoUrls: true,
    source: { select: { name: true } },
    municipality: { select: { latitude: true, longitude: true } },
    lots: { where: { ownerId }, select: { id: true }, take: 1 },
  }) satisfies Prisma.ListingSelect;

type ListingCardRow = Prisma.ListingGetPayload<{ select: ReturnType<typeof listingCardSelect> }>;

const toCents = (value: number | null) => (value === null ? null : cents(value));

/**
 * Base das estimativas (etapa 5, D-36): vendas do catálogo no último ano e a análise fixada mais recente de cada lote
 * do usuário. Carregada uma vez por tela e usada em todos os cartões.
 */
export type EstimateContext = { index: EstimateIndex; analyses: AnalysisSample[]; now: Date };

export async function loadEstimateContext(now: Date): Promise<EstimateContext> {
  const user = await requireUser();
  const [sales, lots] = await Promise.all([
    db.listing.findMany({
      where: {
        status: "sold",
        finalBidCents: { gt: 0 },
        endsAt: { gte: new Date(now.getTime() - SALES_WINDOW_MS) },
      },
      select: {
        brand: true,
        model: true,
        modelYear: true,
        mileageKm: true,
        category: true,
        damageLevel: true,
        finalBidCents: true,
        marketValueCents: true,
      },
    }),
    db.lot.findMany({
      where: { ownerId: user.id, analyses: { some: { status: "fixed" } } },
      select: {
        brand: true,
        model: true,
        modelYear: true,
        analyses: { where: { status: "fixed" }, orderBy: { version: "desc" }, take: 1, select: analysisColumns },
      },
    }),
  ]);

  return {
    index: buildEstimateIndex(
      sales.map(({ finalBidCents, marketValueCents, ...sale }) => ({
        ...sale,
        finalBid: cents(finalBidCents ?? 0),
        marketValue: toCents(marketValueCents),
      })),
    ),
    analyses: lots.flatMap(({ analyses, ...lot }) =>
      analyses.map((analysis) => ({ ...lot, inputs: toInputs(analysis) })),
    ),
    now,
  };
}

/** Só anúncio aberto: encerrado já tem o lance final. */
function estimateFor(row: ListingCardRow, context: EstimateContext | null): ListingEstimate | null {
  if (!context || row.status !== "open" || (row.endsAt !== null && row.endsAt <= context.now)) return null;
  const target = {
    brand: row.brand,
    model: row.model,
    modelYear: row.modelYear,
    mileageKm: row.mileageKm,
    category: row.category,
    damageLevel: row.damageLevel,
    marketValue: toCents(row.marketValueCents),
  };
  return { price: estimatePrice(target, context.index), limit: estimateLimit(target, context.analyses) };
}

export function toListItem(row: ListingCardRow, estimates: EstimateContext | null = null): ListingListItem {
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
    trackable: trackerMissing(row).length === 0,
    trackedLotId: row.lots[0]?.id ?? null,
    estimate: estimateFor(row, estimates),
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
  const user = await requireUser();
  const select = listingCardSelect(user.id);
  const now = new Date();
  // Encerrados já têm lance final: sem estimativa, sem carregar a base.
  const estimates = filters.ended ? Promise.resolve(null) : loadEstimateContext(now);
  const withEstimates = (context: EstimateContext | null) => (row: ListingCardRow) => toListItem(row, context);
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
    const [rows, total, context] = await Promise.all([
      db.listing.findMany({ where, orderBy, skip: start, take: LISTINGS_PAGE_SIZE, select }),
      db.listing.count({ where }),
      estimates,
    ]);
    return {
      items: rows.map(withEstimates(context)),
      total,
      page: filters.page,
      pageSize: LISTINGS_PAGE_SIZE,
      truncated: false,
    };
  }

  // Com raio, o retângulo corta no banco e a distância exata filtra aqui, sobre no máximo MAX_CANDIDATES.
  const [rows, context] = await Promise.all([
    db.listing.findMany({ where, orderBy, take: MAX_CANDIDATES + 1, select }),
    estimates,
  ]);
  const truncated = rows.length > MAX_CANDIDATES;
  const items = rows.slice(0, MAX_CANDIDATES).map(withEstimates(context)).filter(withinRadius(radius));

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
