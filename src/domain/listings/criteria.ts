import type { Cents } from "../money";
import type { DamageLevel } from "./condition";
import type { ListingCategory, ListingStatus } from "./types";

/**
 * Critérios de busca no catálogo: os mesmos para a tela "Descobertos" e para os monitores (etapa 2 de
 * docs/PLANO-COLETA.md). A tela filtra no banco; o coletor usa `matchesCriteria` para gerar alertas.
 * As chaves ("veiculos", "sem-monta") são identificadores estáveis: vão na URL e no banco.
 */

/** Raios oferecidos, em km a partir da região padrão (São Carlos/SP). `null` = qualquer distância. */
export const RADIUS_OPTIONS_KM = [50, 100, 150, 300] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS_KM)[number];
export const DEFAULT_RADIUS_KM: RadiusKm = 150;

/**
 * Grupos de categoria no vocabulário comum (`LISTING_CATEGORIES`, D-37). "veiculos" é o padrão: o que o fluxo de análise cobre.
 * Imóveis e equipamentos ficam no catálogo, mas só aparecem em "todas" (`null`).
 */
export const CATEGORY_KEYS = ["veiculos", "carros", "motos", "utilitarios", "pesados", "sucatas", "todas"] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];
export const CATEGORY_GROUPS = {
  veiculos: ["Carros", "Motos", "Utilitarios"],
  carros: ["Carros"],
  motos: ["Motos"],
  utilitarios: ["Utilitarios"],
  pesados: ["Pesados"],
  sucatas: ["Sucatas"],
  todas: null,
} as const satisfies Record<CategoryKey, readonly ListingCategory[] | null>;
export const DEFAULT_CATEGORY: CategoryKey = "veiculos";

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

export type ListingCriteria = {
  search: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  /** Lance atual ou, sem lance, o inicial. */
  maxPrice: Cents | null;
  radiusKm: number | null;
  category: CategoryKey;
  condition: ConditionKey;
};

/** O que um anúncio precisa expor para ser comparado com os critérios. */
export type MatchableListing = {
  title: string;
  brand: string | null;
  model: string | null;
  fipeName: string | null;
  modelYear: number | null;
  category: string | null;
  damageLevel: DamageLevel | null;
  status: ListingStatus;
  endsAt: Date | null;
  currentBid: Cents | null;
  minimumBid: Cents | null;
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

/** Aberto de fato: situação aberta e fim ainda no futuro (ou desconhecido). */
export function isOpenAt(listing: Pick<MatchableListing, "status" | "endsAt">, now: Date): boolean {
  return listing.status === "open" && (listing.endsAt === null || listing.endsAt > now);
}

/** O anúncio aberto atende a todos os critérios? Mesma regra da busca em "Descobertos". */
export function matchesCriteria(criteria: ListingCriteria, listing: MatchableListing, now: Date): boolean {
  if (!isOpenAt(listing, now)) return false;

  const tokens = searchTokens(criteria.search);
  if (tokens.length > 0) {
    const haystack = toSearchText([listing.title, listing.brand, listing.model, listing.fipeName].join(" "));
    if (!tokens.every((token) => haystack.includes(token))) return false;
  }

  if (criteria.yearFrom !== null && (listing.modelYear === null || listing.modelYear < criteria.yearFrom)) return false;
  if (criteria.yearTo !== null && (listing.modelYear === null || listing.modelYear > criteria.yearTo)) return false;

  if (criteria.maxPrice !== null) {
    const price = listing.currentBid ?? listing.minimumBid;
    if (price === null || price > criteria.maxPrice) return false;
  }

  if (criteria.radiusKm !== null && (listing.distanceKm === null || listing.distanceKm > criteria.radiusKm)) {
    return false;
  }

  const categories: readonly string[] | null = CATEGORY_GROUPS[criteria.category];
  if (categories !== null && (listing.category === null || !categories.includes(listing.category))) return false;

  const rule = CONDITION_RULES[criteria.condition];
  if (rule !== null) {
    const levels: readonly DamageLevel[] = rule.levels;
    const accepted = listing.damageLevel === null ? rule.unclassified : levels.includes(listing.damageLevel);
    if (!accepted) return false;
  }

  return true;
}

function toSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export const isCategoryKey = (value: string): value is CategoryKey => CATEGORY_KEYS.some((key) => key === value);
export const isConditionKey = (value: string): value is ConditionKey => CONDITION_KEYS.some((key) => key === value);
