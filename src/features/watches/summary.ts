import { DEFAULT_CATEGORIES, DEFAULT_CONDITION, type ListingCriteria } from "@/domain/listings/criteria";
import {
  CATEGORY_LABELS,
  CONDITION_PHRASES,
  distanceLabel,
  formatKm,
  FUEL_LABELS,
  HIDE_LABELS,
  ORIGIN_LABELS,
  priceRangeLabel,
  yearRangeLabel,
} from "@/features/listings/filter-labels";
import { type ListingFilters, listingParams } from "@/features/listings/schemas";
import { CATALOG_LISTINGS_PATH, withQuery } from "@/features/listings/search";

/**
 * Critérios em uma linha legível: "VW Fox · 2011–2013 · até R$ 25 mil · até 150 km · sem monta…". Fontes aparecem
 * pelo id quando o nome não é passado.
 */
export function describeCriteria(
  criteria: ListingCriteria,
  sourceNames: Readonly<Record<string, string>> = {},
): string {
  const years = yearRangeLabel(criteria);
  const price = priceRangeLabel(criteria);
  const categories =
    criteria.categories === null
      ? "todas as categorias"
      : sameItems(criteria.categories, DEFAULT_CATEGORIES)
        ? null
        : criteria.categories.map((key) => CATEGORY_LABELS[key]).join(", ");

  return [
    criteria.search,
    years === null ? null : lower(years),
    price === null ? null : lower(price),
    criteria.maxMarketPct === null ? null : `até ${criteria.maxMarketPct}% do mercado`,
    criteria.maxMileageKm === null ? null : `até ${formatKm(criteria.maxMileageKm)}`,
    lower(distanceLabel(criteria.radiusKm)),
    categories,
    criteria.condition === DEFAULT_CONDITION ? null : CONDITION_PHRASES[criteria.condition],
    criteria.hide.length === 0 ? null : `sem ${criteria.hide.map((key) => HIDE_LABELS[key].toLowerCase()).join(", ")}`,
    criteria.fuels.length === 0 ? null : criteria.fuels.map((key) => FUEL_LABELS[key]).join(", "),
    criteria.origins.length === 0
      ? null
      : `origem: ${criteria.origins.map((key) => ORIGIN_LABELS[key].toLowerCase()).join(", ")}`,
    criteria.sources.length === 0 ? null : criteria.sources.map((id) => sourceNames[id] ?? id).join(", "),
    criteria.keyOnly ? "só com chave" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Título do monitor: o nome dado ou, sem nome, a busca (ou os critérios). */
export function watchTitle(name: string | null, criteria: ListingCriteria): string {
  return name ?? criteria.search ?? describeCriteria(criteria);
}

/** Link para "Todos os veículos" com os mesmos critérios ("ver os que combinam agora"). */
export function discoveredHref(criteria: ListingCriteria) {
  const filters: ListingFilters = {
    criteria,
    endsWithin: null,
    bids: null,
    newOnly: false,
    analyzed: null,
    ended: false,
    sort: "encerra",
    page: 1,
  };
  return withQuery(CATALOG_LISTINGS_PATH, listingParams(filters));
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const sameItems = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));
