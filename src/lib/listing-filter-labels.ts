import {
  type CategoryKey,
  type ConditionKey,
  DEFAULT_CATEGORIES,
  DEFAULT_CONDITION,
  DEFAULT_CRITERIA,
  DEFAULT_RADIUS_KM,
  type FuelKey,
  type HideKey,
  type ListingCriteria,
  type OriginKey,
} from "@/domain/listings/criteria";

import { formatDecimal } from "./format";
import type { EndsWithin, ListingFilters, SortKey } from "./listing-filters";

export const CATEGORY_LABELS = {
  carros: "Carros",
  motos: "Motos",
  utilitarios: "Utilitários",
  pesados: "Pesados",
  sucatas: "Sucatas",
  outros: "Outros",
} satisfies Record<CategoryKey, string>;

export const CONDITION_LABELS = {
  qualquer: "Qualquer",
  "sem-monta": "Sem monta",
  "ate-pequena": "Até pequena",
  "ate-media": "Até média",
  "com-monta": "Só com monta",
} satisfies Record<ConditionKey, string>;

/** Condição numa frase (chips, resumo do monitor). */
export const CONDITION_PHRASES = {
  qualquer: "qualquer condição",
  "sem-monta": "sem monta ou sucata informada",
  "ate-pequena": "até pequena monta",
  "ate-media": "até média monta",
  "com-monta": "só com monta",
} satisfies Record<ConditionKey, string>;

export const HIDE_LABELS = {
  impedido: "Circulação vedada",
  remarcado: "Remarcado",
  airbag: "Airbag acionado",
  "laudo-reprovado": "Laudo reprovado",
} satisfies Record<HideKey, string>;

export const ORIGIN_LABELS = {
  financiamento: "Financiamento",
  seguradora: "Seguradora",
  frota: "Frota",
  orgao_publico: "Órgão público",
  outros: "Outras",
} satisfies Record<OriginKey, string>;

export const FUEL_LABELS = {
  flex: "Flex",
  gasolina: "Gasolina",
  diesel: "Diesel",
  eletrico: "Elétrico ou híbrido",
} satisfies Record<FuelKey, string>;

export const ENDS_WITHIN_LABELS = {
  "24h": "24 h",
  "48h": "48 h",
  "7d": "7 dias",
} satisfies Record<EndsWithin, string>;

export const SORT_LABELS = {
  encerra: "Encerra primeiro",
  "menor-lance": "Menor lance",
  mercado: "Menor % do mercado",
  perto: "Mais perto",
  novos: "Novos primeiro",
} satisfies Record<SortKey, string>;

/** Na aba de encerrados, "encerra" quer dizer os que encerraram há menos tempo. */
export const sortLabel = (sort: SortKey, ended: boolean) =>
  ended && sort === "encerra" ? "Encerrados há menos tempo" : SORT_LABELS[sort];

/** "R$ 30 mil", "R$ 7,5 mil", "R$ 800": compacto para botões e chips. */
export function compactBRL(cents: number): string {
  const reais = Math.round(cents / 100);
  if (reais < 1_000) return `R$ ${reais}`;
  const thousands = reais / 1_000;
  return `R$ ${formatDecimal(thousands)} mil`;
}

export const formatKm = (km: number) => `${formatDecimal(km / 1_000, 3)} mil km`;

/** Resumo da faixa de preço para o botão e o chip; `null` sem faixa. */
export function priceRangeLabel(criteria: Pick<ListingCriteria, "minPrice" | "maxPrice">): string | null {
  const { minPrice, maxPrice } = criteria;
  if (minPrice !== null && maxPrice !== null) return `${compactBRL(minPrice)} a ${compactBRL(maxPrice)}`;
  if (minPrice !== null) return `A partir de ${compactBRL(minPrice)}`;
  if (maxPrice !== null) return `Até ${compactBRL(maxPrice)}`;
  return null;
}

/** "2015–2020", "A partir de 2015", "Até 2020"; `null` sem faixa. */
export function yearRangeLabel(criteria: Pick<ListingCriteria, "yearFrom" | "yearTo">): string | null {
  const { yearFrom, yearTo } = criteria;
  if (yearFrom !== null && yearTo !== null) return yearFrom === yearTo ? String(yearFrom) : `${yearFrom}–${yearTo}`;
  if (yearFrom !== null) return `A partir de ${yearFrom}`;
  if (yearTo !== null) return `Até ${yearTo}`;
  return null;
}

export const distanceLabel = (radiusKm: number | null) =>
  radiusKm === null ? "Qualquer distância" : `Até ${radiusKm} km`;

/** Filtro ativo como chip: o texto e os filtros sem ele (o "×"). */
export type ActiveFilter = { id: string; label: string; without: ListingFilters };

/**
 * Filtros ativos, na ordem da barra. Padrões (distância de 150 km, veículos, abertos, ordem) não viram chip:
 * a distância e a categoria aparecem nos próprios controles. `sourceNames` dá o nome das fontes.
 */
export function activeFilters(filters: ListingFilters, sourceNames: Readonly<Record<string, string>>): ActiveFilter[] {
  const { criteria } = filters;
  const withCriteria = (patch: Partial<ListingCriteria>): ListingFilters => ({
    ...filters,
    criteria: { ...criteria, ...patch },
    page: 1,
  });
  const withFilters = (patch: Partial<ListingFilters>): ListingFilters => ({ ...filters, ...patch, page: 1 });
  const chips: ActiveFilter[] = [];
  const add = (id: string, label: string | null, without: ListingFilters) => {
    if (label !== null) chips.push({ id, label, without });
  };

  add("busca", criteria.search ? `“${criteria.search}”` : null, withCriteria({ search: null }));
  const price = priceRangeLabel(criteria);
  add("preco", price, withCriteria({ minPrice: null, maxPrice: null }));
  add(
    "mercado",
    criteria.maxMarketPct === null ? null : `Até ${criteria.maxMarketPct}% do mercado`,
    withCriteria({ maxMarketPct: null }),
  );
  const years = yearRangeLabel(criteria);
  add("ano", years === null ? null : `Ano: ${years}`, withCriteria({ yearFrom: null, yearTo: null }));
  add(
    "distancia",
    criteria.radiusKm === DEFAULT_RADIUS_KM ? null : distanceLabel(criteria.radiusKm),
    withCriteria({ radiusKm: DEFAULT_RADIUS_KM }),
  );
  if (criteria.categories === null) {
    add("categoria", "Todas as categorias", withCriteria({ categories: DEFAULT_CATEGORIES }));
  } else if (!sameItems(criteria.categories, DEFAULT_CATEGORIES)) {
    add(
      "categoria",
      criteria.categories.map((key) => CATEGORY_LABELS[key]).join(", "),
      withCriteria({ categories: DEFAULT_CATEGORIES }),
    );
  }
  add(
    "km",
    criteria.maxMileageKm === null ? null : `Até ${formatKm(criteria.maxMileageKm)}`,
    withCriteria({ maxMileageKm: null }),
  );
  for (const fuel of criteria.fuels) {
    add(`combustivel-${fuel}`, FUEL_LABELS[fuel], withCriteria({ fuels: criteria.fuels.filter((f) => f !== fuel) }));
  }
  add("chave", criteria.keyOnly ? "Só com chave" : null, withCriteria({ keyOnly: false }));
  add(
    "condicao",
    criteria.condition === DEFAULT_CONDITION ? null : capitalize(CONDITION_PHRASES[criteria.condition]),
    withCriteria({ condition: DEFAULT_CONDITION }),
  );
  for (const key of criteria.hide) {
    add(
      `ocultar-${key}`,
      `Sem ${HIDE_LABELS[key].toLowerCase()}`,
      withCriteria({ hide: criteria.hide.filter((item) => item !== key) }),
    );
  }
  for (const source of criteria.sources) {
    add(
      `fonte-${source}`,
      sourceNames[source] ?? source,
      withCriteria({ sources: criteria.sources.filter((item) => item !== source) }),
    );
  }
  for (const origin of criteria.origins) {
    add(
      `origem-${origin}`,
      `Origem: ${ORIGIN_LABELS[origin].toLowerCase()}`,
      withCriteria({ origins: criteria.origins.filter((item) => item !== origin) }),
    );
  }
  add(
    "encerra",
    filters.endsWithin === null ? null : `Encerra em ${ENDS_WITHIN_LABELS[filters.endsWithin]}`,
    withFilters({ endsWithin: null }),
  );
  add(
    "lances",
    filters.bids === null ? null : filters.bids === "com" ? "Com lances" : "Sem lances",
    withFilters({ bids: null }),
  );
  add("novos", filters.newOnly ? "Novos (24 h)" : null, withFilters({ newOnly: false }));
  add(
    "analisados",
    filters.analyzed === null ? null : filters.analyzed === "so" ? "Só já analisados" : "Sem os já analisados",
    withFilters({ analyzed: null }),
  );
  return chips;
}

/** Filtros sem nenhuma restrição além dos padrões, mantendo situação e ordem ("Limpar tudo"). */
export function clearedFilters(filters: ListingFilters): ListingFilters {
  return {
    ...filters,
    criteria: DEFAULT_CRITERIA,
    endsWithin: null,
    bids: null,
    newOnly: false,
    analyzed: null,
    page: 1,
  };
}

function sameItems(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
