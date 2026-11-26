import "server-only";

import type { DamageLevel } from "@/domain/listings/condition";
import {
  CATEGORY_OF_KEY,
  CONDITION_RULES,
  type ConditionKey,
  type FuelKey,
  fuelOf,
  HIDE_FLAGS,
  type HideKey,
  type ListingCriteria,
  NAMED_CATEGORIES,
  type OriginKey,
  searchTokens,
} from "@/domain/listings/criteria";
import { estimateLimit, estimatePrice, limitFit, limitMaxBid } from "@/domain/listings/estimates";
import { distanceKm } from "@/domain/listings/geo";
import { DEFAULT_REGION, type RegionConfig } from "@/domain/listings/region";
import { trackerMissing } from "@/domain/listings/tracker";
import { cents } from "@/domain/money";
import type { Prisma } from "@/generated/prisma/client";
import { defaultsInputFromListing, type ListingForDefaults } from "@/lib/draft-defaults";
import { fuelSpellings, municipalitiesWithin } from "@/server/catalog-values";

import { ENDS_WITHIN_HOURS, type ListingFilters, NEW_WINDOW_MS, type SortKey } from "../schemas";
import type { CatalogAuctionKey, ListingEstimate, ListingListItem } from "../types";
import type { EstimateContext } from "./estimates";

/** Teto de anúncios lidos para ordenar por distância (a ordem é calculada aqui, não no banco). */
export const MAX_CANDIDATES = 2_000;

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
    vehicleOrigin: true,
    fipeCode: true,
    marketValueFipeCode: true,
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

export type ListingCardRow = Prisma.ListingGetPayload<{ select: ReturnType<typeof listingCardSelect> }>;

export const toCents = (value: number | null) => (value === null ? null : cents(value));

/** O que a estimativa lê do anúncio: o cartão inteiro ou só os campos de um candidato da home. */
type EstimateRow = ListingForDefaults &
  Pick<
    ListingCardRow,
    | "status"
    | "endsAt"
    | "brand"
    | "model"
    | "modelYear"
    | "mileageKm"
    | "fipeCode"
    | "marketValueFipeCode"
    | "vehicleOrigin"
  >;

/** Só anúncio aberto: encerrado já tem o lance final. */
export function estimateFor(row: EstimateRow, context: EstimateContext | null): ListingEstimate | null {
  if (!context || row.status !== "open" || (row.endsAt !== null && row.endsAt <= context.now)) return null;
  const target = {
    brand: row.brand,
    model: row.model,
    modelYear: row.modelYear,
    mileageKm: row.mileageKm,
    category: row.category,
    damageLevel: row.damageLevel,
    fipeCode: row.fipeCode ?? row.marketValueFipeCode,
    origin: row.vehicleOrigin,
    marketValue: toCents(row.marketValueCents),
  };
  const price = estimatePrice(target, context.index);
  // Os cartões não exibem `saleIds`; omitir a lista evita serializar centenas de UUIDs por card no payload RSC.
  const compactPrice = price.kind === "comparables" ? { ...price, saleIds: [] } : price;
  const limit = estimateLimit(
    target,
    context.analyses,
    defaultsInputFromListing(row, context.region),
    context.costOverrides,
  );
  return { price: compactPrice, limit, fit: limitFit(compactPrice, limitMaxBid(limit)) };
}

export function toListItem(
  row: ListingCardRow,
  estimates: EstimateContext | null = null,
  region: RegionConfig = estimates?.region ?? DEFAULT_REGION,
): ListingListItem {
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
    distanceKm: row.municipality ? distanceKm(region.center, row.municipality) : null,
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

/** Distância exata no banco: o município do anúncio está entre os do raio (`municipalitiesWithin`). */
export function radiusWhere(nearby: readonly number[] | null): Prisma.ListingWhereInput {
  return nearby === null ? {} : { municipalityId: { in: [...nearby] } };
}

/** Chaves de categoria → categorias do vocabulário comum; "outros" é o resto, inclusive o anúncio sem categoria. */
export function categoriesWhere(keys: ListingCriteria["categories"]): Prisma.ListingWhereInput {
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

/**
 * Cada palavra da busca precisa aparecer em `search_text` (maiúsculas sem acento, D-91, índice GIN `pg_trgm`).
 */
export function searchWhere(search: string | null): Prisma.ListingWhereInput {
  return {
    AND: searchTokens(search).map((token) => ({
      searchText: { contains: token },
    })),
  };
}

/**
 * O que os critérios precisam do catálogo para virar filtro no banco (com cache, D-78): as grafias de combustível
 * (a classificação é do domínio, `fuelOf`; no banco o filtro vira `in` sobre as grafias de cada chave) e os municípios
 * do raio. A origem já está gravada no anúncio (D-73).
 */
export type CriteriaValues = { fuels: string[]; nearby: number[] | null };

export async function loadCriteriaValues(
  criteria: ListingCriteria,
  region: RegionConfig = DEFAULT_REGION,
): Promise<CriteriaValues> {
  const [fuels, nearby] = await Promise.all([
    criteria.fuels.length === 0 ? [] : fuelSpellings(),
    criteria.radiusKm === null ? null : municipalitiesWithin(criteria.radiusKm, region.center),
  ]);
  return { fuels, nearby };
}

export function originWhere(origins: readonly OriginKey[]): Prisma.ListingWhereInput {
  return origins.length === 0 ? {} : { vehicleOrigin: { in: [...origins] } };
}

export function fuelWhere(fuels: readonly FuelKey[], values: CriteriaValues): Prisma.ListingWhereInput {
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
export function openWhere(now: Date): Prisma.ListingWhereInput {
  return { status: "open", OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
}

/**
 * Critérios no banco, inclusive a distância. Mesma regra de `matchesCriteria`; preço e % do mercado usam as colunas
 * geradas (`price_cents`, `market_ratio_bps`).
 */
export function criteriaWhere(criteria: ListingCriteria, values: CriteriaValues): Prisma.ListingWhereInput {
  return {
    AND: [
      radiusWhere(values.nearby),
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
      originWhere(criteria.origins),
      fuelWhere(criteria.fuels, values),
      criteria.keyOnly ? { hasKey: true } : {},
    ],
  };
}

/** Filtros só da tela (não valem para monitores): prazo, lances, novos e já analisados. */
export function screenWhere(filters: ListingFilters, ownerId: string, now: Date): Prisma.ListingWhereInput {
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

export const auctionWhere = ({ sourceId, externalId }: CatalogAuctionKey): Prisma.ListingWhereInput => ({
  sourceId,
  auctionExternalId: externalId,
});

/** Tudo o que a tela filtra no banco: situação, critérios e filtros da tela; com `auction`, só aquele leilão. */
export function listingsWhere(
  filters: ListingFilters,
  values: CriteriaValues,
  ownerId: string,
  now: Date,
  auction?: CatalogAuctionKey,
): Prisma.ListingWhereInput {
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
export function listingsOrderBy(filters: ListingFilters): Prisma.ListingOrderByWithRelationInput[] {
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
