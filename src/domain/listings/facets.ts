import {
  CATEGORY_KEYS,
  type CategoryKey,
  categoryKeyOf,
  type FacetCriteria,
  type FacetListing,
  FUEL_KEYS,
  type FuelKey,
  fuelOf,
  matchesCategories,
  matchesFuels,
  matchesOrigins,
  matchesSearch,
  matchesSources,
  ORIGIN_KEYS,
  type OriginKey,
  originOf,
  toSearchText,
} from "./criteria";

/**
 * Contagens dos chips de filtro (docs/PLANO-FILTROS.md §4): cada faceta é contada com todos os outros filtros
 * aplicados e sem ela mesma, para o número dizer quantos lotes a tela mostraria ao marcar aquele chip sozinho.
 * Recebe os anúncios já filtrados pelos critérios que não são faceta (ano, preço, distância…).
 */
export type ListingFacets = {
  categories: Record<CategoryKey, number>;
  sources: Record<string, number>;
  origins: Record<OriginKey, number>;
  fuels: Record<FuelKey, number>;
  /** Sugestões da busca: marca e marca + primeira palavra do modelo, das mais frequentes. */
  suggestions: SearchSuggestion[];
};

export type SearchSuggestion = { label: string; count: number };

/** Sugestões enviadas à tela; a busca filtra entre elas enquanto o usuário digita. */
export const MAX_SUGGESTIONS = 300;

const zeroes = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

export function computeFacets(rows: readonly FacetListing[], criteria: FacetCriteria): ListingFacets {
  const passes = (row: FacetListing, skip: keyof FacetCriteria | null) =>
    (skip === "search" || matchesSearch(criteria.search, row)) &&
    (skip === "categories" || matchesCategories(criteria.categories, row)) &&
    (skip === "sources" || matchesSources(criteria.sources, row)) &&
    (skip === "origins" || matchesOrigins(criteria.origins, row)) &&
    (skip === "fuels" || matchesFuels(criteria.fuels, row));

  const categories = zeroes(CATEGORY_KEYS);
  const sources: Record<string, number> = {};
  const origins = zeroes(ORIGIN_KEYS);
  const fuels = zeroes(FUEL_KEYS);
  const suggestions = new Map<string, number>();

  for (const row of rows) {
    if (passes(row, "categories")) categories[categoryKeyOf(row.category)] += 1;
    if (passes(row, "sources")) sources[row.sourceId] = (sources[row.sourceId] ?? 0) + 1;
    if (passes(row, "origins")) origins[originOf(row.recoveryType)] += 1;
    if (passes(row, "fuels")) {
      const fuel = fuelOf(row.fuel);
      if (fuel !== null) fuels[fuel] += 1;
    }
    if (passes(row, "search")) {
      for (const label of suggestionLabels(row)) suggestions.set(label, (suggestions.get(label) ?? 0) + 1);
    }
  }

  return {
    categories,
    sources,
    origins,
    fuels,
    suggestions: [...suggestions]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, MAX_SUGGESTIONS),
  };
}

/** "FORD" e "FORD KA" para marca "FORD" e modelo "KA SE 1.0 HA". Sem marca, nada. */
function suggestionLabels(row: FacetListing): string[] {
  const brand = toSearchText(row.brand ?? "");
  if (!brand) return [];
  const [model] = toSearchText(row.model ?? "").split(" ");
  return model && model !== brand ? [brand, `${brand} ${model}`] : [brand];
}

/**
 * Sugestões que casam com o texto digitado: todas as palavras precisam aparecer, e a última pode estar pela metade
 * ("for k" sugere "FORD KA"). As que começam pelo texto vêm primeiro.
 */
export function matchSuggestions(
  suggestions: readonly SearchSuggestion[],
  typed: string,
  limit = 8,
): SearchSuggestion[] {
  const tokens = toSearchText(typed).split(" ").filter(Boolean);
  if (tokens.length === 0) return [];
  const query = tokens.join(" ");
  return suggestions
    .filter((suggestion) => {
      const words = suggestion.label.split(" ");
      return tokens.every((token) => words.some((word) => word.startsWith(token)));
    })
    .filter((suggestion) => suggestion.label !== query)
    .sort((a, b) => Number(b.label.startsWith(query)) - Number(a.label.startsWith(query)))
    .slice(0, limit);
}
