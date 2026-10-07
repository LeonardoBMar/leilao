import "server-only";

import {
  catalogAuctionDate,
  type CatalogAuctionStats,
  selectCatalogAuctions,
} from "@/domain/listings/catalog-auctions";
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
import { collectorHealth, overallHealth } from "@/domain/listings/health";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { trackerMissing } from "@/domain/listings/tracker";
import { cents } from "@/domain/money";
import { analysisColumns, toInputs } from "@/features/analyses/queries";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import { CATALOG_AUCTIONS_PAGE_SIZE, type ListingFilters, LISTINGS_PAGE_SIZE } from "./schemas";
import type {
  CatalogAuctionDetail,
  CatalogAuctionKey,
  CatalogAuctionPage,
  CollectorStatus,
  ListingEstimate,
  ListingListItem,
  ListingPage,
} from "./types";

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

/** Filtros da URL no formato comum de critérios (o mesmo dos monitores). */
function criteriaOf(filters: ListingFilters): ListingCriteria {
  return {
    search: filters.search ?? null,
    yearFrom: filters.yearFrom ?? null,
    yearTo: filters.yearTo ?? null,
    maxPrice: filters.maxPrice ?? null,
    radiusKm: filters.distanceKm,
    category: filters.category,
    condition: filters.condition,
  };
}

const auctionWhere = ({ sourceId, externalId }: CatalogAuctionKey): Prisma.ListingWhereInput => ({
  sourceId,
  auctionExternalId: externalId,
});

/** Anúncios com os filtros da URL; com `auction`, só os daquele leilão do catálogo. */
export async function listListings(
  filters: ListingFilters,
  scope: { auction?: CatalogAuctionKey } = {},
): Promise<ListingPage> {
  const user = await requireUser();
  const select = listingCardSelect(user.id);
  const now = new Date();
  // Encerrados já têm lance final: sem estimativa, sem carregar a base.
  const estimates = filters.ended ? Promise.resolve(null) : loadEstimateContext(now);
  const withEstimates = (context: EstimateContext | null) => (row: ListingCardRow) => toListItem(row, context);
  const where: Prisma.ListingWhereInput = {
    AND: [
      scope.auction ? auctionWhere(scope.auction) : {},
      filters.ended ? { NOT: openWhere(now) } : openWhere(now),
      criteriaWhere(criteriaOf(filters)),
    ],
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

const keyOf = (sourceId: string, externalId: string) => JSON.stringify([sourceId, externalId]);

/** Contagem por leilão (chave `keyOf`); anúncio sem leilão fica de fora. */
function countByAuction(pairs: readonly { sourceId: string; auctionExternalId: string | null; count?: number }[]) {
  const counts = new Map<string, CatalogAuctionKey & { count: number }>();
  for (const { sourceId, auctionExternalId, count = 1 } of pairs) {
    if (auctionExternalId === null) continue;
    const key = keyOf(sourceId, auctionExternalId);
    const entry = counts.get(key) ?? { sourceId, externalId: auctionExternalId, count: 0 };
    counts.set(key, { ...entry, count: entry.count + count });
  }
  return counts;
}

/**
 * Leilões do catálogo de uma aba (D-42), com os números de cada um. Os filtros são os dos anúncios: o leilão aparece
 * se tem lote no filtro. Na aba de abertos, conta só lotes abertos; na de encerrados, todos.
 */
export async function listCatalogAuctions(filters: ListingFilters): Promise<CatalogAuctionPage> {
  const user = await requireUser();
  const now = new Date();
  const where: Prisma.ListingWhereInput = {
    AND: [
      { auctionExternalId: { not: null } },
      filters.ended ? {} : openWhere(now),
      criteriaWhere(criteriaOf(filters)),
    ],
  };

  let matching: ReturnType<typeof countByAuction>;
  let truncated = false;
  if (filters.distanceKm === null) {
    const groups = await db.listing.groupBy({ by: ["sourceId", "auctionExternalId"], where, _count: { _all: true } });
    matching = countByAuction(groups.map((group) => ({ ...group, count: group._count._all })));
  } else {
    // Com raio, mesma regra da lista de anúncios: retângulo no banco, distância exata aqui.
    const rows = await db.listing.findMany({
      where,
      take: MAX_CANDIDATES + 1,
      select: {
        sourceId: true,
        auctionExternalId: true,
        municipality: { select: { latitude: true, longitude: true } },
      },
    });
    truncated = rows.length > MAX_CANDIDATES;
    matching = countByAuction(
      rows
        .slice(0, MAX_CANDIDATES)
        .map((row) => ({
          ...row,
          distanceKm: row.municipality ? distanceKm(DEFAULT_REGION.center, row.municipality) : null,
        }))
        .filter(withinRadius(filters.distanceKm)),
    );
  }

  const stats = await loadCatalogAuctionStats(user.id, [...matching.values()], now);
  const selected = selectCatalogAuctions(
    stats.map((item) => ({ ...item, matching: matching.get(keyOf(item.sourceId, item.externalId))?.count ?? 0 })),
    filters.ended,
  );
  const start = (filters.page - 1) * CATALOG_AUCTIONS_PAGE_SIZE;

  return {
    items: selected.slice(start, start + CATALOG_AUCTIONS_PAGE_SIZE),
    total: selected.length,
    page: filters.page,
    pageSize: CATALOG_AUCTIONS_PAGE_SIZE,
    truncated,
  };
}

/** Um leilão do catálogo, para o cabeçalho da sua página; `null` se não há anúncio dele. */
export async function getCatalogAuction(key: CatalogAuctionKey): Promise<CatalogAuctionDetail | null> {
  const user = await requireUser();
  const [[stats], userAuction] = await Promise.all([
    loadCatalogAuctionStats(user.id, [key], new Date()),
    db.auction.findUnique({
      where: { ownerId_sourceId_externalId: { ownerId: user.id, ...key } },
      select: { id: true },
    }),
  ]);
  if (!stats) return null;
  return { ...stats, date: catalogAuctionDate(stats), isOpen: stats.open > 0, userAuctionId: userAuction?.id ?? null };
}

type CatalogAuctionStatsRow = CatalogAuctionStats & { sourceName: string };

/** Números de cada leilão do catálogo. `matching` sai zerado: depende dos filtros da tela. */
async function loadCatalogAuctionStats(
  ownerId: string,
  keys: readonly CatalogAuctionKey[],
  now: Date,
): Promise<CatalogAuctionStatsRow[]> {
  if (keys.length === 0) return [];
  const inKeys: Prisma.ListingWhereInput = { OR: keys.map(auctionWhere) };
  const [totals, opens, names, lots, sources] = await Promise.all([
    db.listing.groupBy({
      by: ["sourceId", "auctionExternalId"],
      where: inKeys,
      _count: { _all: true },
      _min: { auctionStartsAt: true, startsAt: true, endsAt: true },
    }),
    db.listing.groupBy({
      by: ["sourceId", "auctionExternalId"],
      where: { AND: [inKeys, openWhere(now)] },
      _count: { _all: true },
    }),
    // Nome do anúncio visto mais recentemente: o leilão pode mudar de nome entre coletas.
    db.listing.findMany({
      where: inKeys,
      distinct: ["sourceId", "auctionExternalId"],
      orderBy: [{ sourceId: "asc" }, { auctionExternalId: "asc" }, { lastSeenAt: "desc" }],
      select: { sourceId: true, auctionExternalId: true, auctionName: true },
    }),
    db.lot.findMany({
      where: { ownerId, listing: inKeys },
      select: { listing: { select: { sourceId: true, auctionExternalId: true } } },
    }),
    db.source.findMany({ select: { id: true, name: true } }),
  ]);

  const openByKey = countByAuction(opens.map((group) => ({ ...group, count: group._count._all })));
  const countOf = (counts: ReturnType<typeof countByAuction>, key: string) => counts.get(key)?.count ?? 0;
  const analyzedByKey = countByAuction(lots.flatMap(({ listing }) => (listing ? [listing] : [])));
  const nameByKey = new Map(
    names.flatMap((row) =>
      row.auctionExternalId === null ? [] : [[keyOf(row.sourceId, row.auctionExternalId), row.auctionName] as const],
    ),
  );
  const sourceNames = new Map(sources.map((source) => [source.id, source.name]));

  return totals.flatMap((group) => {
    if (group.auctionExternalId === null) return [];
    const key = keyOf(group.sourceId, group.auctionExternalId);
    return [
      {
        sourceId: group.sourceId,
        sourceName: sourceNames.get(group.sourceId) ?? group.sourceId,
        externalId: group.auctionExternalId,
        name: nameByKey.get(key) ?? null,
        auctionStartsAt: group._min.auctionStartsAt,
        firstStartsAt: group._min.startsAt,
        firstEndsAt: group._min.endsAt,
        total: group._count._all,
        open: countOf(openByKey, key),
        matching: 0,
        analyzed: countOf(analyzedByKey, key),
      },
    ];
  });
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

/** Saúde do coletor para o dashboard e para "Leilões": última execução de cada fonte e abertos na região. */
export async function getCollectorStatus(): Promise<CollectorStatus> {
  await requireUser();
  const now = new Date();

  const [sources, openCandidates] = await Promise.all([
    // Última execução de cada fonte ativa (D-37): uma fonte parada não fica escondida atrás das outras.
    db.source.findMany({
      where: { active: true },
      select: {
        name: true,
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { status: true, startedAt: true, finishedAt: true, failed: true },
        },
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
  const runs = sources.flatMap(({ name, runs: [run] }) =>
    run ? [{ ...run, name, health: collectorHealth(run, now) }] : [],
  );
  const finished = runs.flatMap((run) => (run.finishedAt ? [run.finishedAt.getTime()] : []));

  return {
    health: overallHealth(runs.map((run) => run.health)),
    lastFinishedAt: finished.length > 0 ? new Date(Math.max(...finished)) : null,
    failingSources: runs.filter((run) => run.health === "failed").map((run) => run.name),
    failedListings: runs.reduce((total, run) => total + run.failed, 0),
    openInRegion,
    regionLabel: DEFAULT_REGION.label,
    radiusKm: DEFAULT_REGION.radiusKm,
  };
}
