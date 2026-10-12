import {
  CATEGORY_KEYS,
  type CategoryKey,
  categoryKeyOf,
  FUEL_KEYS,
  type FuelKey,
  fuelOf,
  ORIGIN_KEYS,
  type OriginKey,
  toSearchText,
} from "./criteria";

/**
 * Contagens dos chips de filtro (docs/PLANO-FILTROS.md §4): cada faceta é contada com todos os outros filtros
 * aplicados e sem ela mesma, para o número dizer quantos lotes a tela mostraria ao marcar aquele chip sozinho.
 * O banco agrupa (uma consulta por faceta, já com os outros filtros); aqui os grupos viram as chaves da tela.
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

/** Contagens agrupadas pelo banco, cada faceta sem o próprio filtro. */
export type FacetGroups = {
  categories: readonly { category: string | null; count: number }[];
  sources: readonly { sourceId: string; count: number }[];
  origins: readonly { origin: OriginKey; count: number }[];
  fuels: readonly { fuel: string | null; count: number }[];
  /** Marca e modelo como a fonte escreve, para as sugestões da busca. */
  vehicles: readonly { brand: string | null; model: string | null; count: number }[];
};

/** Sugestões enviadas à tela; a busca filtra entre elas enquanto o usuário digita. */
export const MAX_SUGGESTIONS = 300;

const zeroes = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

export function facetsFromGroups(groups: FacetGroups): ListingFacets {
  const categories = zeroes(CATEGORY_KEYS);
  for (const { category, count } of groups.categories) categories[categoryKeyOf(category)] += count;

  const sources: Record<string, number> = {};
  for (const { sourceId, count } of groups.sources) sources[sourceId] = (sources[sourceId] ?? 0) + count;

  const origins = zeroes(ORIGIN_KEYS);
  for (const { origin, count } of groups.origins) origins[origin] += count;

  const fuels = zeroes(FUEL_KEYS);
  for (const { fuel, count } of groups.fuels) {
    const key = fuelOf(fuel);
    if (key !== null) fuels[key] += count;
  }

  const suggestions = new Map<string, number>();
  for (const { count, ...vehicle } of groups.vehicles) {
    for (const label of suggestionLabels(vehicle)) suggestions.set(label, (suggestions.get(label) ?? 0) + count);
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
function suggestionLabels(vehicle: { brand: string | null; model: string | null }): string[] {
  const brand = toSearchText(vehicle.brand ?? "");
  if (!brand) return [];
  const [model] = toSearchText(vehicle.model ?? "").split(" ");
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
