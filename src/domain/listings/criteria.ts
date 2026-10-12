import { type Cents, cents } from "../money";
import type { ConditionFlag, DamageLevel, InspectionResult } from "./condition";
import { VEHICLE_ORIGINS, type VehicleOrigin } from "./origin";
import type { ListingCategory, ListingStatus } from "./types";

/**
 * Critérios de busca no catálogo: os mesmos para a tela "Leilões" e para os monitores (etapa 2 de
 * docs/PLANO-COLETA.md, ampliados em docs/PLANO-FILTROS.md). A tela filtra no banco; o coletor usa `matchesCriteria`
 * para gerar alertas. As chaves ("carros", "sem-monta") são identificadores estáveis: vão na URL e no banco.
 */

/** Raios oferecidos, em km a partir da região padrão (São Carlos/SP). `null` = qualquer distância. */
export const RADIUS_OPTIONS_KM = [50, 100, 150, 300] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS_KM)[number];
export const DEFAULT_RADIUS_KM: RadiusKm = 150;

/**
 * Categorias de escolha múltipla, no vocabulário comum (`LISTING_CATEGORIES`, D-37). "outros" junta equipamentos,
 * imóveis, aeronaves e anúncios sem categoria. O padrão é o que o fluxo de análise cobre: carros, motos e utilitários.
 */
export const CATEGORY_KEYS = ["carros", "motos", "utilitarios", "pesados", "sucatas", "outros"] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];
const KEY_CATEGORY = {
  carros: "Carros",
  motos: "Motos",
  utilitarios: "Utilitarios",
  pesados: "Pesados",
  sucatas: "Sucatas",
} as const satisfies Record<Exclude<CategoryKey, "outros">, ListingCategory>;
export const DEFAULT_CATEGORIES: readonly CategoryKey[] = ["carros", "motos", "utilitarios"];

/** Chaves de grupo usadas antes das categorias múltiplas (URLs antigas e monitores gravados até D-43). */
export const LEGACY_CATEGORY_GROUPS = {
  veiculos: DEFAULT_CATEGORIES,
  todas: null,
} as const satisfies Record<string, readonly CategoryKey[] | null>;

/** Chave da categoria do anúncio. */
export function categoryKeyOf(category: string | null): CategoryKey {
  return CATEGORY_KEYS.find((key) => key !== "outros" && KEY_CATEGORY[key] === category) ?? "outros";
}

/** Categoria do vocabulário comum de cada chave; `outros` cobre as demais e o anúncio sem categoria. */
export const CATEGORY_OF_KEY: Readonly<Record<Exclude<CategoryKey, "outros">, ListingCategory>> = KEY_CATEGORY;
export const NAMED_CATEGORIES: readonly ListingCategory[] = Object.values(KEY_CATEGORY);

/**
 * Condição declarada (`condition.ts`). `unclassified`: aceita o lote sem classificação (a maioria, em geral
 * recuperado de financiamento). A fonte não diz que não há dano, então a UI fala em "não informada".
 */
export const CONDITION_KEYS = ["qualquer", "sem-monta", "ate-pequena", "ate-media", "com-monta"] as const;
export type ConditionKey = (typeof CONDITION_KEYS)[number];
export const CONDITION_RULES = {
  qualquer: null,
  "sem-monta": { unclassified: true, levels: [] },
  "ate-pequena": { unclassified: true, levels: ["small"] },
  "ate-media": { unclassified: true, levels: ["small", "medium"] },
  "com-monta": { unclassified: false, levels: ["small", "medium", "large"] },
} as const satisfies Record<ConditionKey, { unclassified: boolean; levels: readonly DamageLevel[] } | null>;
export const DEFAULT_CONDITION: ConditionKey = "qualquer";

/** Alertas da condição que o usuário pode esconder. Laudo reprovado vem do laudo cautelar, não das marcas. */
export const HIDE_KEYS = ["impedido", "remarcado", "airbag", "laudo-reprovado"] as const;
export type HideKey = (typeof HIDE_KEYS)[number];
export const HIDE_FLAGS = {
  impedido: "circulation_banned",
  remarcado: "remarked",
  airbag: "airbag_deployed",
} as const satisfies Record<Exclude<HideKey, "laudo-reprovado">, ConditionFlag>;

/**
 * Origem do veículo (`inferOrigin`, D-73): gravada no anúncio pela coleta (`vehicle_origin`). As chaves são as do
 * banco e vão na URL e nos monitores; "orgao_publico" entrou em 11/10/2026, as outras são as de D-43.
 */
export const ORIGIN_KEYS = VEHICLE_ORIGINS;
export type OriginKey = VehicleOrigin;

/** Combustível, normalizado do texto da fonte (27 grafias). Sem termo reconhecido: `null` (não se adivinha). */
export const FUEL_KEYS = ["flex", "gasolina", "diesel", "eletrico"] as const;
export type FuelKey = (typeof FUEL_KEYS)[number];

export function fuelOf(fuel: string | null): FuelKey | null {
  const text = toSearchText(fuel ?? "");
  if (/ELETR|HIBRID/.test(text)) return "eletrico";
  if (/FLEX|\bALC|ALCOOL|ETANOL/.test(text)) return "flex";
  if (/DIESEL/.test(text)) return "diesel";
  if (/\bGAS/.test(text)) return "gasolina";
  return null;
}

/** Teto do preço frente ao valor de mercado (da fonte ou casado na FIPE; D-30, D-47), em %. */
export const MARKET_PCT_OPTIONS = [40, 50, 60, 70, 80] as const;
/** Teto de quilometragem. */
export const MILEAGE_OPTIONS_KM = [50_000, 100_000, 150_000] as const;

export type ListingCriteria = {
  search: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  /** Faixa do preço: lance atual ou, sem lance, o inicial (`priceOf`). */
  minPrice: Cents | null;
  maxPrice: Cents | null;
  /** Preço até X% do valor de mercado; anúncio sem valor de mercado fica de fora. */
  maxMarketPct: number | null;
  maxMileageKm: number | null;
  radiusKm: number | null;
  /** `null` = todas as categorias. */
  categories: readonly CategoryKey[] | null;
  condition: ConditionKey;
  hide: readonly HideKey[];
  /** Ids das fontes; vazio = todas. Origem e combustível: vazio = todos. */
  sources: readonly string[];
  origins: readonly OriginKey[];
  fuels: readonly FuelKey[];
  keyOnly: boolean;
};

/** Critérios sem nenhuma restrição além dos padrões da tela (base para monitores e testes). */
export const DEFAULT_CRITERIA: ListingCriteria = {
  search: null,
  yearFrom: null,
  yearTo: null,
  minPrice: null,
  maxPrice: null,
  maxMarketPct: null,
  maxMileageKm: null,
  radiusKm: DEFAULT_RADIUS_KM,
  categories: DEFAULT_CATEGORIES,
  condition: DEFAULT_CONDITION,
  hide: [],
  sources: [],
  origins: [],
  fuels: [],
  keyOnly: false,
};

/** O que um anúncio precisa expor para ser comparado com os critérios. */
export type MatchableListing = {
  sourceId: string;
  title: string;
  brand: string | null;
  model: string | null;
  fipeName: string | null;
  modelYear: number | null;
  mileageKm: number | null;
  category: string | null;
  fuel: string | null;
  origin: VehicleOrigin;
  hasKey: boolean | null;
  damageLevel: DamageLevel | null;
  conditionFlags: readonly ConditionFlag[];
  inspection: InspectionResult | null;
  status: ListingStatus;
  endsAt: Date | null;
  currentBid: Cents | null;
  minimumBid: Cents | null;
  marketValue: Cents | null;
  /** Distância em linha reta até a região padrão; nula se a cidade não foi reconhecida. */
  distanceKm: number | null;
};

/**
 * Palavras da busca, sem acento e em maiúsculas. Todas precisam aparecer no título, marca, modelo ou nome FIPE
 * (em qualquer ordem): "vw fox" encontra "VW/FOX 1.0".
 */
export function searchTokens(search: string | null | undefined): string[] {
  if (!search) return [];
  return toSearchText(search).split(" ").filter(Boolean);
}

/** Preço de referência do anúncio: lance atual ou, sem lance, o inicial. Igual à coluna gerada `price_cents`. */
export function priceOf(listing: Pick<MatchableListing, "currentBid" | "minimumBid">): Cents | null {
  return listing.currentBid ?? listing.minimumBid;
}

/** Preço ÷ valor de mercado, em basis points (6.000 = 60%). Igual à coluna gerada `market_ratio_bps`. */
export function marketRatioBps(price: Cents | null, marketValue: Cents | null): number | null {
  if (price === null || marketValue === null || marketValue <= 0) return null;
  return Math.round((price * 10_000) / marketValue);
}

/** Aberto de fato: situação aberta e fim ainda no futuro (ou desconhecido). */
export function isOpenAt(listing: Pick<MatchableListing, "status" | "endsAt">, now: Date): boolean {
  return listing.status === "open" && (listing.endsAt === null || listing.endsAt > now);
}

/** Critérios que viram chips com contagem (facetas): cada um é contado com os outros aplicados. */
export type FacetCriteria = Pick<ListingCriteria, "search" | "categories" | "sources" | "origins" | "fuels">;
export type FacetListing = Pick<
  MatchableListing,
  "sourceId" | "title" | "brand" | "model" | "fipeName" | "category" | "origin" | "fuel"
>;

export function matchesSearch(search: string | null, listing: FacetListing): boolean {
  const tokens = searchTokens(search);
  if (tokens.length === 0) return true;
  const haystack = toSearchText([listing.title, listing.brand, listing.model, listing.fipeName].join(" "));
  return tokens.every((token) => haystack.includes(token));
}

export const matchesCategories = (categories: FacetCriteria["categories"], listing: Pick<FacetListing, "category">) =>
  categories === null || categories.includes(categoryKeyOf(listing.category));
export const matchesSources = (sources: FacetCriteria["sources"], listing: Pick<FacetListing, "sourceId">) =>
  sources.length === 0 || sources.includes(listing.sourceId);
export const matchesOrigins = (origins: FacetCriteria["origins"], listing: Pick<FacetListing, "origin">) =>
  origins.length === 0 || origins.includes(listing.origin);
export function matchesFuels(fuels: FacetCriteria["fuels"], listing: Pick<FacetListing, "fuel">): boolean {
  if (fuels.length === 0) return true;
  const fuel = fuelOf(listing.fuel);
  return fuel !== null && fuels.includes(fuel);
}

/** O anúncio aberto atende a todos os critérios? Mesma regra da busca em "Leilões". */
export function matchesCriteria(criteria: ListingCriteria, listing: MatchableListing, now: Date): boolean {
  if (!isOpenAt(listing, now)) return false;
  if (!matchesSearch(criteria.search, listing)) return false;

  if (criteria.yearFrom !== null && (listing.modelYear === null || listing.modelYear < criteria.yearFrom)) return false;
  if (criteria.yearTo !== null && (listing.modelYear === null || listing.modelYear > criteria.yearTo)) return false;

  const price = priceOf(listing);
  if (criteria.minPrice !== null && (price === null || price < criteria.minPrice)) return false;
  if (criteria.maxPrice !== null && (price === null || price > criteria.maxPrice)) return false;
  if (criteria.maxMarketPct !== null) {
    const ratio = marketRatioBps(price, listing.marketValue);
    if (ratio === null || ratio > criteria.maxMarketPct * 100) return false;
  }
  if (criteria.maxMileageKm !== null && (listing.mileageKm === null || listing.mileageKm > criteria.maxMileageKm)) {
    return false;
  }

  if (criteria.radiusKm !== null && (listing.distanceKm === null || listing.distanceKm > criteria.radiusKm)) {
    return false;
  }

  if (!matchesCategories(criteria.categories, listing)) return false;
  if (!matchesSources(criteria.sources, listing)) return false;
  if (!matchesOrigins(criteria.origins, listing)) return false;
  if (!matchesFuels(criteria.fuels, listing)) return false;
  if (criteria.keyOnly && listing.hasKey !== true) return false;

  const rule = CONDITION_RULES[criteria.condition];
  if (rule !== null) {
    const levels: readonly DamageLevel[] = rule.levels;
    const accepted = listing.damageLevel === null ? rule.unclassified : levels.includes(listing.damageLevel);
    if (!accepted) return false;
  }

  return criteria.hide.every((key) =>
    key === "laudo-reprovado" ? listing.inspection !== "rejected" : !listing.conditionFlags.includes(HIDE_FLAGS[key]),
  );
}

/** Maiúsculas, sem acento e só letras e números separados por espaço simples. */
export function toSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const isOneOf =
  <T extends string>(keys: readonly T[]) =>
  (value: string): value is T =>
    keys.some((key) => key === value);
export const isCategoryKey = isOneOf(CATEGORY_KEYS);
export const isConditionKey = isOneOf(CONDITION_KEYS);
export const isHideKey = isOneOf(HIDE_KEYS);
export const isOriginKey = isOneOf(ORIGIN_KEYS);
export const isFuelKey = isOneOf(FUEL_KEYS);

/** Critérios como ficam gravados num monitor: chaves em texto, dinheiro em centavos, lista vazia = sem restrição. */
export type StoredCriteria = {
  search: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  maxMarketPct: number | null;
  maxMileageKm: number | null;
  radiusKm: number | null;
  categories: string[];
  condition: string;
  hide: string[];
  sources: string[];
  origins: string[];
  fuels: string[];
  keyOnly: boolean;
};

/** O banco só aceita chaves conhecidas (CHECK); os filtros aqui só estreitam o tipo. */
export function criteriaFromStored(stored: StoredCriteria): ListingCriteria {
  const categories = stored.categories.filter(isCategoryKey);
  return {
    search: stored.search,
    yearFrom: stored.yearFrom,
    yearTo: stored.yearTo,
    minPrice: stored.minPriceCents === null ? null : cents(stored.minPriceCents),
    maxPrice: stored.maxPriceCents === null ? null : cents(stored.maxPriceCents),
    maxMarketPct: stored.maxMarketPct,
    maxMileageKm: stored.maxMileageKm,
    radiusKm: stored.radiusKm,
    categories: categories.length === 0 ? null : categories,
    condition: isConditionKey(stored.condition) ? stored.condition : DEFAULT_CONDITION,
    hide: stored.hide.filter(isHideKey),
    sources: stored.sources,
    origins: stored.origins.filter(isOriginKey),
    fuels: stored.fuels.filter(isFuelKey),
    keyOnly: stored.keyOnly,
  };
}

export function criteriaToStored(criteria: ListingCriteria): StoredCriteria {
  return {
    search: criteria.search,
    yearFrom: criteria.yearFrom,
    yearTo: criteria.yearTo,
    minPriceCents: criteria.minPrice,
    maxPriceCents: criteria.maxPrice,
    maxMarketPct: criteria.maxMarketPct,
    maxMileageKm: criteria.maxMileageKm,
    radiusKm: criteria.radiusKm,
    categories: criteria.categories === null ? [] : [...criteria.categories],
    condition: criteria.condition,
    hide: [...criteria.hide],
    sources: [...criteria.sources],
    origins: [...criteria.origins],
    fuels: [...criteria.fuels],
    keyOnly: criteria.keyOnly,
  };
}
