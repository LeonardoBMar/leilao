import "server-only";

import { cache } from "react";

import {
  catalogAuctionDate,
  type CatalogAuctionStats,
  selectCatalogAuctions,
} from "@/domain/listings/catalog-auctions";
import type { DamageLevel } from "@/domain/listings/condition";
import {
  CATEGORY_OF_KEY,
  CONDITION_RULES,
  type ConditionKey,
  criteriaFromStored,
  DEFAULT_CATEGORIES,
  DEFAULT_CRITERIA,
  type FuelKey,
  fuelOf,
  HIDE_FLAGS,
  type HideKey,
  type ListingCriteria,
  type MatchableListing,
  matchesCriteria,
  NAMED_CATEGORIES,
  type OriginKey,
  originOf,
  searchTokens,
} from "@/domain/listings/criteria";
import {
  type AnalysisSample,
  buildEstimateIndex,
  byAnalysisPriority,
  type EstimateIndex,
  estimateLimit,
  estimatePrice,
  limitFit,
  limitMaxBid,
  SALES_WINDOW_MS,
} from "@/domain/listings/estimates";
import { computeFacets } from "@/domain/listings/facets";
import { boundingBox, distanceKm } from "@/domain/listings/geo";
import { collectorHealth, overallHealth } from "@/domain/listings/health";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { trackerMissing } from "@/domain/listings/tracker";
import { cents } from "@/domain/money";
import { defaultsInputFromListing } from "@/features/analyses/draft-defaults";
import { analysisColumns, toInputs } from "@/features/analyses/queries";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { storedCriteriaSelect } from "@/server/collector/alerts";
import { db } from "@/server/db";

import {
  CATALOG_AUCTIONS_PAGE_SIZE,
  ENDS_WITHIN_HOURS,
  type ListingFilters,
  LISTINGS_PAGE_SIZE,
  NEW_WINDOW_MS,
  type SortKey,
} from "./schemas";
import type {
  CatalogAuctionDetail,
  CatalogAuctionKey,
  CatalogAuctionPage,
  CollectorStatus,
  ListingEstimate,
  ListingFacetsView,
  ListingListItem,
  ListingPage,
  RegionOverview,
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
    marketValueOrigin: true,
    marketValueRefMonth: true,
    category: true,
    photoUrls: true,
    // Taxas do anúncio: entram no limite pelas premissas padrão (D-44), como no rascunho.
    commissionBps: true,
    dispatcherFeeCents: true,
    removalFeeCents: true,
    storageFeeCents: true,
    inspectionFeeCents: true,
    otherFeesCents: true,
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

/**
 * A mesma base, uma vez por requisição (memo do `React.cache`, como `getCurrentUser`; D-44): cabeçalho e blocos do
 * dashboard leem as estimativas sem recarregar as vendas. Não guarda nada entre requisições (D-04).
 */
export const getEstimateContext = cache(async (): Promise<EstimateContext> => {
  await requireUser();
  return loadEstimateContext(new Date());
});

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
  const price = estimatePrice(target, context.index);
  const limit = estimateLimit(target, context.analyses, defaultsInputFromListing(row));
  return { price, limit, fit: limitFit(price, limitMaxBid(limit)) };
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
    marketValueOrigin: row.marketValueOrigin,
    marketValueRefMonth: row.marketValueRefMonth,
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

/** Chaves de categoria → categorias do vocabulário comum; "outros" é o resto, inclusive o anúncio sem categoria. */
function categoriesWhere(keys: ListingCriteria["categories"]): Prisma.ListingWhereInput {
  if (keys === null) return {};
  const named = keys.flatMap((key) => (key === "outros" ? [] : [CATEGORY_OF_KEY[key]]));
  return {
    OR: [
      { category: { in: named } },
      ...(keys.includes("outros") ? [{ category: { notIn: [...NAMED_CATEGORIES] } }, { category: null }] : []),
    ],
  };
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

/** Esconde marcas da condição e laudo reprovado (laudo ausente passa: `<>` sozinho descartaria o nulo). */
function hideWhere(keys: readonly HideKey[]): Prisma.ListingWhereInput {
  return {
    AND: keys.map((key): Prisma.ListingWhereInput =>
      key === "laudo-reprovado"
        ? { OR: [{ inspectionResult: null }, { inspectionResult: { not: "rejected" } }] }
        : { NOT: { conditionFlags: { has: HIDE_FLAGS[key] } } },
    ),
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

/**
 * Grafias de origem e combustível presentes no catálogo (poucas dezenas). A classificação é do domínio
 * (`originOf`, `fuelOf`); no banco o filtro vira `in` sobre as grafias que caem em cada chave.
 */
type TextValues = { recoveryTypes: string[]; fuels: string[] };

async function loadTextValues(criteria: ListingCriteria): Promise<TextValues> {
  const [recoveryTypes, fuels] = await Promise.all([
    criteria.origins.length === 0
      ? []
      : db.listing.findMany({ distinct: ["recoveryType"], select: { recoveryType: true } }),
    criteria.fuels.length === 0 ? [] : db.listing.findMany({ distinct: ["fuel"], select: { fuel: true } }),
  ]);
  return {
    recoveryTypes: recoveryTypes.flatMap(({ recoveryType }) => (recoveryType === null ? [] : [recoveryType])),
    fuels: fuels.flatMap(({ fuel }) => (fuel === null ? [] : [fuel])),
  };
}

function originWhere(origins: readonly OriginKey[], values: TextValues): Prisma.ListingWhereInput {
  if (origins.length === 0) return {};
  const matching = values.recoveryTypes.filter((value) => origins.includes(originOf(value)));
  return {
    OR: [{ recoveryType: { in: matching } }, ...(origins.includes("outros") ? [{ recoveryType: null }] : [])],
  };
}

function fuelWhere(fuels: readonly FuelKey[], values: TextValues): Prisma.ListingWhereInput {
  if (fuels.length === 0) return {};
  return {
    fuel: {
      in: values.fuels.filter((value) => {
        const fuel = fuelOf(value);
        return fuel !== null && fuels.includes(fuel);
      }),
    },
  };
}

/** Aberto de fato: situação aberta e fim ainda no futuro (ou desconhecido). Mesma regra de `isOpenAt`. */
function openWhere(now: Date): Prisma.ListingWhereInput {
  return { status: "open", OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
}

/**
 * Critérios no banco, exceto a distância exata (o retângulo só pré-filtra; `withinRadius` completa). Mesma regra de
 * `matchesCriteria`; preço e % do mercado usam as colunas geradas (`price_cents`, `market_ratio_bps`).
 */
function criteriaWhere(criteria: ListingCriteria, values: TextValues): Prisma.ListingWhereInput {
  return {
    AND: [
      withinBox(criteria.radiusKm),
      categoriesWhere(criteria.categories),
      conditionWhere(criteria.condition),
      hideWhere(criteria.hide),
      searchWhere(criteria.search),
      criteria.yearFrom === null ? {} : { modelYear: { gte: criteria.yearFrom } },
      criteria.yearTo === null ? {} : { modelYear: { lte: criteria.yearTo } },
      criteria.minPrice === null ? {} : { priceCents: { gte: criteria.minPrice } },
      criteria.maxPrice === null ? {} : { priceCents: { lte: criteria.maxPrice } },
      criteria.maxMarketPct === null ? {} : { marketRatioBps: { lte: criteria.maxMarketPct * 100 } },
      criteria.maxMileageKm === null ? {} : { mileageKm: { lte: criteria.maxMileageKm } },
      criteria.sources.length === 0 ? {} : { sourceId: { in: [...criteria.sources] } },
      originWhere(criteria.origins, values),
      fuelWhere(criteria.fuels, values),
      criteria.keyOnly ? { hasKey: true } : {},
    ],
  };
}

/** Filtros só da tela (não valem para monitores): prazo, lances, novos e já analisados. */
function screenWhere(filters: ListingFilters, ownerId: string, now: Date): Prisma.ListingWhereInput {
  return {
    AND: [
      filters.endsWithin === null
        ? {}
        : { endsAt: { lte: new Date(now.getTime() + ENDS_WITHIN_HOURS[filters.endsWithin] * 60 * 60 * 1000) } },
      // Sem lance atual = sem lance (o inicial fica em `minimumBid`), em todas as fontes.
      filters.bids === null ? {} : { currentBidCents: filters.bids === "com" ? { not: null } : null },
      filters.newOnly ? { firstSeenAt: { gte: new Date(now.getTime() - NEW_WINDOW_MS) } } : {},
      filters.analyzed === null
        ? {}
        : filters.analyzed === "so"
          ? { lots: { some: { ownerId } } }
          : { lots: { none: { ownerId } } },
    ],
  };
}

const withinRadius = (radiusKm: number | null) => (item: { distanceKm: number | null }) =>
  radiusKm === null || (item.distanceKm !== null && item.distanceKm <= radiusKm);

const auctionWhere = ({ sourceId, externalId }: CatalogAuctionKey): Prisma.ListingWhereInput => ({
  sourceId,
  auctionExternalId: externalId,
});

/** Tudo o que a tela filtra no banco: situação, critérios e filtros da tela; com `auction`, só aquele leilão. */
async function listingsWhere(
  filters: ListingFilters,
  ownerId: string,
  now: Date,
  auction?: CatalogAuctionKey,
): Promise<Prisma.ListingWhereInput> {
  const values = await loadTextValues(filters.criteria);
  return {
    AND: [
      auction ? auctionWhere(auction) : {},
      filters.ended ? { NOT: openWhere(now) } : openWhere(now),
      criteriaWhere(filters.criteria, values),
      screenWhere(filters, ownerId, now),
    ],
  };
}

/** Ordem no banco; "mais perto" ordena pela distância calculada (caminho de candidatos). */
function listingsOrderBy(filters: ListingFilters): Prisma.ListingOrderByWithRelationInput[] {
  const byEnd: Prisma.ListingOrderByWithRelationInput = { endsAt: filters.ended ? "desc" : "asc" };
  const bySort: Record<SortKey, Prisma.ListingOrderByWithRelationInput> = {
    encerra: byEnd,
    "menor-lance": { priceCents: { sort: "asc", nulls: "last" } },
    mercado: { marketRatioBps: { sort: "asc", nulls: "last" } },
    novos: { firstSeenAt: "desc" },
    perto: byEnd,
  };
  const first = bySort[filters.sort];
  return first === byEnd ? [byEnd, { id: "asc" }] : [first, byEnd, { id: "asc" }];
}

const byDistance = (a: { distanceKm: number | null }, b: { distanceKm: number | null }) =>
  (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);

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
  const where = await listingsWhere(filters, user.id, now, scope.auction);
  const orderBy = listingsOrderBy(filters);
  const start = (filters.page - 1) * LISTINGS_PAGE_SIZE;
  const radius = filters.criteria.radiusKm;

  // Sem raio e sem ordem por distância, tudo é filtrável e ordenável no banco: pagina lá.
  if (radius === null && filters.sort !== "perto") {
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
  // Ordenação estável: empates na distância mantêm a ordem do banco.
  if (filters.sort === "perto") items.sort(byDistance);

  return {
    items: items.slice(start, start + LISTINGS_PAGE_SIZE),
    total: items.length,
    page: filters.page,
    pageSize: LISTINGS_PAGE_SIZE,
    truncated,
  };
}

/** Teto de anúncios lidos para facetas e sugestões; acima dele as contagens ficam parciais. */
const MAX_FACET_ROWS = 10_000;

/**
 * Contagens dos chips (categoria, fonte, origem, combustível) e sugestões da busca (docs/PLANO-FILTROS.md §4):
 * os anúncios no filtro sem os critérios de faceta, contados em `computeFacets`.
 */
export async function getListingFacets(
  filters: ListingFilters,
  scope: { auction?: CatalogAuctionKey } = {},
): Promise<ListingFacetsView> {
  const user = await requireUser();
  const now = new Date();
  const withoutFacets: ListingFilters = {
    ...filters,
    criteria: { ...filters.criteria, search: null, categories: null, sources: [], origins: [], fuels: [] },
  };
  const [rows, sources] = await Promise.all([
    db.listing.findMany({
      where: await listingsWhere(withoutFacets, user.id, now, scope.auction),
      take: MAX_FACET_ROWS,
      select: {
        sourceId: true,
        title: true,
        brand: true,
        model: true,
        fipeName: true,
        category: true,
        recoveryType: true,
        fuel: true,
        municipality: { select: { latitude: true, longitude: true } },
      },
    }),
    db.source.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const inRadius = rows
    .map(({ municipality, ...row }) => ({
      ...row,
      distanceKm: municipality ? distanceKm(DEFAULT_REGION.center, municipality) : null,
    }))
    .filter(withinRadius(filters.criteria.radiusKm));
  const facets = computeFacets(inRadius, filters.criteria);

  return {
    ...facets,
    sources: sources.map((source) => ({ ...source, count: facets.sources[source.id] ?? 0 })),
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
  // Na aba de encerrados, o leilão entra com qualquer lote no filtro: a situação é do leilão (`selectCatalogAuctions`).
  const where: Prisma.ListingWhereInput = {
    AND: [
      { auctionExternalId: { not: null } },
      filters.ended ? {} : openWhere(now),
      criteriaWhere(filters.criteria, await loadTextValues(filters.criteria)),
      screenWhere(filters, user.id, now),
    ],
  };

  let matching: ReturnType<typeof countByAuction>;
  let truncated = false;
  if (filters.criteria.radiusKm === null) {
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
        .filter(withinRadius(filters.criteria.radiusKm)),
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

/** Cartões em "Para analisar agora" e leilões em "Próximos leilões na região" (D-44). */
const TO_ANALYZE_SHOWN = 6;
const REGION_AUCTIONS_SHOWN = 5;
const REGION_AUCTIONS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const fits = (item: ListingListItem) => item.estimate?.fit === "comfortable" || item.estimate?.fit === "tight";

/**
 * O catálogo visto da home (D-44): anúncios abertos no filtro padrão (`DEFAULT_CRITERIA`) ou em algum monitor ligado
 * do usuário. Daí saem "Para analisar agora" (ainda sem lote do usuário, com o provável cabendo no limite, na ordem de
 * `byAnalysisPriority`) e os leilões dos próximos 7 dias, com lotes no filtro e quantos cabem. Memo por requisição:
 * o cabeçalho e os dois blocos do dashboard leem o mesmo resultado.
 */
export const getRegionOverview = cache(async (): Promise<RegionOverview> => {
  const user = await requireUser();
  const now = new Date();
  const [watches, context] = await Promise.all([
    db.watch.findMany({ where: { ownerId: user.id, active: true }, select: storedCriteriaSelect }),
    getEstimateContext(),
  ]);
  const criteriaList = [DEFAULT_CRITERIA, ...watches.map(criteriaFromStored)];
  const wheres = await Promise.all(
    criteriaList.map(async (criteria) => criteriaWhere(criteria, await loadTextValues(criteria))),
  );

  const rows = await db.listing.findMany({
    // O banco pré-filtra (retângulo de cada critério); `matchesCriteria` aplica a regra exata, inclusive a distância.
    where: { AND: [openWhere(now), { auctionExternalId: { not: null } }, { OR: wheres }] },
    orderBy: [{ endsAt: "asc" }, { id: "asc" }],
    take: MAX_CANDIDATES + 1,
    select: { ...listingCardSelect(user.id), sourceId: true, fipeName: true, hasKey: true },
  });
  const truncated = rows.length > MAX_CANDIDATES;
  const matching = rows
    .slice(0, MAX_CANDIDATES)
    .map((row) => ({ row, item: toListItem(row, context) }))
    .filter(({ row, item }) => {
      const listing = toMatchable(row, item.distanceKm);
      return criteriaList.some((criteria) => matchesCriteria(criteria, listing, now));
    });

  const toAnalyze = matching
    .flatMap(({ item }) =>
      item.trackedLotId === null && item.estimate && fits(item)
        ? [{ item, candidate: { ...item.estimate, endsAt: item.endsAt } }]
        : [],
    )
    .sort((a, b) => byAnalysisPriority(a.candidate, b.candidate))
    .map(({ item }) => item);

  // Leilões: só anúncios que encerram nos próximos 7 dias.
  const soon = matching.filter(
    ({ row }) => row.endsAt !== null && row.endsAt.getTime() - now.getTime() <= REGION_AUCTIONS_WINDOW_MS,
  );
  const inFilter = countByAuction(soon.map(({ row }) => row));
  const fitting = countByAuction(soon.filter(({ item }) => fits(item)).map(({ row }) => row));
  const stats = await loadCatalogAuctionStats(user.id, [...inFilter.values()], now);
  const auctions = selectCatalogAuctions(
    stats.map((item) => ({ ...item, matching: inFilter.get(keyOf(item.sourceId, item.externalId))?.count ?? 0 })),
    false,
  )
    .slice(0, REGION_AUCTIONS_SHOWN)
    .map((item) => ({ ...item, fitting: fitting.get(keyOf(item.sourceId, item.externalId))?.count ?? 0 }));

  return {
    toAnalyze: toAnalyze.slice(0, TO_ANALYZE_SHOWN),
    toAnalyzeTotal: toAnalyze.length,
    auctions,
    auctionsTotal: inFilter.size,
    truncated,
  };
});

type MatchableRow = ListingCardRow & { sourceId: string; fipeName: string | null; hasKey: boolean | null };

function toMatchable(row: MatchableRow, distance: number | null): MatchableListing {
  return {
    sourceId: row.sourceId,
    title: row.title,
    brand: row.brand,
    model: row.model,
    fipeName: row.fipeName,
    modelYear: row.modelYear,
    mileageKm: row.mileageKm,
    category: row.category,
    fuel: row.fuel,
    recoveryType: row.recoveryType,
    hasKey: row.hasKey,
    damageLevel: row.damageLevel,
    conditionFlags: row.conditionFlags,
    inspection: row.inspectionResult,
    status: row.status,
    endsAt: row.endsAt,
    currentBid: toCents(row.currentBidCents),
    minimumBid: toCents(row.minimumBidCents),
    marketValue: toCents(row.marketValueCents),
    distanceKm: distance,
  };
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

/** Fontes ativas, para escolher nos filtros e nos monitores. */
export async function listActiveSources(): Promise<{ id: string; name: string }[]> {
  await requireUser();
  return db.source.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** Quantos anúncios abertos atendem aos critérios agora (ex.: "12 lotes combinam com este monitor"). */
export async function countOpenListings(criteria: ListingCriteria): Promise<{ count: number; truncated: boolean }> {
  await requireUser();
  const where: Prisma.ListingWhereInput = {
    AND: [openWhere(new Date()), criteriaWhere(criteria, await loadTextValues(criteria))],
  };
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
      where: { AND: [openWhere(now), withinBox(DEFAULT_REGION.radiusKm), categoriesWhere(DEFAULT_CATEGORIES)] },
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
