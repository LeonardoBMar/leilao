import { RESEARCH_CONDITIONS, type ResearchFilters } from "@/domain/research/filters";

import { CONDITION_LABELS, salesLabel } from "./labels";
import type { ResearchFacets } from "./types";

/** Um jeito de sair do filtro vazio: o texto do link e os filtros para onde ele leva. */
export type NoSalesSuggestion = { label: string; filters: ResearchFilters };

/** Quantas saídas oferecer: mais que isso volta a ser uma lista de filtros. */
const MAX_SUGGESTIONS = 3;

const total = (counts: readonly number[]) => counts.reduce((sum, count) => sum + count, 0);

/**
 * Saídas para o bloco sem vendas (DESIGN.md §15.8): cada uma afrouxa um filtro e diz quantas vendas aparecem. As
 * contagens são as da barra de filtros (cada uma com os outros filtros), então a saída só é oferecida quando há venda.
 * Ordem: o que mais amplia primeiro (estado, faixa de ano, fonte, km, modelo), depois a condição com mais vendas.
 */
export function noSalesSuggestions(filters: ResearchFilters, facets: ResearchFacets): NoSalesSuggestion[] {
  const suggestions: NoSalesSuggestion[] = [];

  if (filters.state !== null) {
    const national = total(Object.values(facets.states));
    if (national > 0) {
      suggestions.push({ label: `Ver o Brasil todo (${salesLabel(national)})`, filters: { ...filters, state: null } });
    }
  }

  if (filters.yearFrom !== null || filters.yearTo !== null) {
    const anyYear = total(facets.years.map(({ sales }) => sales));
    if (anyYear > 0) {
      suggestions.push({
        label: `Tirar a faixa de ano (${salesLabel(anyYear)})`,
        filters: { ...filters, yearFrom: null, yearTo: null },
      });
    }
  }

  if (filters.source !== null) {
    const anySource = total(facets.sources.map(({ sales }) => sales));
    if (anySource > 0) {
      suggestions.push({
        label: `Ver todas as fontes (${salesLabel(anySource)})`,
        filters: { ...filters, source: null },
      });
    }
  }

  if (filters.maxKm !== null && facets.mileage.total > 0) {
    suggestions.push({
      label: `Tirar o limite de km (${salesLabel(facets.mileage.total)})`,
      filters: { ...filters, maxKm: null },
    });
  }

  if (filters.vehicle !== null) {
    suggestions.push({
      label: "Ver todos os modelos",
      filters: { ...filters, vehicle: null, yearFrom: null, yearTo: null },
    });
  }

  const otherCondition = RESEARCH_CONDITIONS.filter((condition) => condition !== filters.condition)
    .map((condition) => ({ condition, sales: facets.conditions[condition] }))
    .filter(({ sales }) => sales > 0)
    .toSorted((x, y) => y.sales - x.sales)[0];
  if (otherCondition !== undefined) {
    suggestions.push({
      label: `Ver ${CONDITION_LABELS[otherCondition.condition].toLowerCase()} (${salesLabel(otherCondition.sales)})`,
      filters: { ...filters, condition: otherCondition.condition },
    });
  }

  return suggestions.slice(0, MAX_SUGGESTIONS);
}
