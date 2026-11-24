import { DEFAULT_RESEARCH_FILTERS, type ResearchFilters } from "@/domain/research/filters";
import { STATE_NAMES } from "@/domain/research/states";

import { mileageLabel, periodLabel, yearRangeLabel } from "../../labels";

/** Filtro ativo da gaveta, como chip removível. */
export type ActiveResearchFilter = { id: string; label: string; without: ResearchFilters };

/** Os filtros da gaveta que fogem do padrão, na ordem da gaveta. Modelo, condição e categoria ficam na barra. */
export function activeResearchFilters(
  filters: ResearchFilters,
  sourceNames: Readonly<Record<string, string>>,
): ActiveResearchFilter[] {
  const years = yearRangeLabel(filters);
  return [
    filters.state === null
      ? null
      : { id: "uf", label: STATE_NAMES[filters.state], without: { ...filters, state: null } },
    filters.source === null
      ? null
      : { id: "fonte", label: sourceNames[filters.source] ?? filters.source, without: { ...filters, source: null } },
    filters.maxKm === null
      ? null
      : { id: "km", label: `Até ${mileageLabel(filters.maxKm)}`, without: { ...filters, maxKm: null } },
    years === null ? null : { id: "ano", label: years, without: { ...filters, yearFrom: null, yearTo: null } },
    filters.period === null
      ? null
      : { id: "periodo", label: periodLabel(filters.period), without: { ...filters, period: null } },
  ].filter((chip) => chip !== null);
}

/** Os filtros com a gaveta no padrão: modelo, condição, categoria e comparação ficam. */
export function withoutResearchDrawerFilters(filters: ResearchFilters): ResearchFilters {
  return {
    ...filters,
    state: null,
    source: null,
    maxKm: null,
    yearFrom: null,
    yearTo: null,
    period: null,
  };
}

/** Mantém o modelo escolhido, voltando condição, categoria, gaveta e comparação ao padrão (como no Avaliar). */
export function withoutResearchRefinements(filters: ResearchFilters): ResearchFilters {
  return {
    ...DEFAULT_RESEARCH_FILTERS,
    vehicle: filters.vehicle,
  };
}
