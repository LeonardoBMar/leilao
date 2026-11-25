import { type VEHICLE_ORIGINS } from "@/domain/listings/origin";
import { DEFAULT_EVALUATE_FILTERS, type EvaluateFilters, familyLabel } from "@/domain/research/evaluate";
import { type RESEARCH_CONDITIONS } from "@/domain/research/filters";
import { ORIGIN_LABELS } from "@/lib/listing-filter-labels";

import { mileageLabel, yearRangeLabel } from "../../labels";

type Option = { value: string; label: string; n: number };

/** Contagens dos seletores do recorte (cada uma sem a própria dimensão). */
export type EvaluateFacets = {
  families: Option[];
  versions: Option[];
  origins: Record<(typeof VEHICLE_ORIGINS)[number], number>;
  conditions: Record<(typeof RESEARCH_CONDITIONS)[number], number>;
  years: { year: number; n: number }[];
  /** Vendas na conta (sem as excluídas). */
  total: number;
};

export type EvaluateLotContext = {
  id: string;
  label: string;
  details: string;
};

export type ActiveEvaluateRefinement = { id: string; label: string; without: EvaluateFilters };

/** Refinamentos da gaveta fora do padrão, como chips removíveis. */
export function activeEvaluateRefinements(
  filters: EvaluateFilters,
  facets: EvaluateFacets,
): ActiveEvaluateRefinement[] {
  const years = yearRangeLabel(filters);
  const versionLabel = facets.versions.find((option) => option.value === filters.version)?.label ?? filters.version;
  return [
    filters.family === null
      ? null
      : {
          id: "familia",
          label: `Família: ${familyLabel(filters.family)}`,
          without: { ...filters, family: null, version: null },
        },
    filters.version === null || versionLabel === null
      ? null
      : { id: "versao", label: `Versão: ${versionLabel}`, without: { ...filters, version: null } },
    years === null
      ? null
      : { id: "ano", label: `Ano: ${years}`, without: { ...filters, yearFrom: null, yearTo: null } },
    filters.maxKm === null
      ? null
      : { id: "km", label: `Até ${mileageLabel(filters.maxKm)}`, without: { ...filters, maxKm: null } },
    filters.origin === null
      ? null
      : { id: "origem", label: ORIGIN_LABELS[filters.origin], without: { ...filters, origin: null } },
  ].filter((chip) => chip !== null);
}

/** Mantém o modelo, o lote alvo e a condição da barra, limpando só os filtros da gaveta. */
export function withoutEvaluateDrawerFilters(filters: EvaluateFilters): EvaluateFilters {
  return {
    ...filters,
    family: null,
    version: null,
    yearFrom: null,
    yearTo: null,
    maxKm: null,
    origin: null,
  };
}

/** Mantém o modelo e o lote alvo, voltando todos os refinamentos ao padrão. */
export function withoutEvaluateRefinements(filters: EvaluateFilters): EvaluateFilters {
  return {
    ...DEFAULT_EVALUATE_FILTERS,
    vehicle: filters.vehicle,
    lot: filters.lot,
    excluded: filters.excluded,
  };
}

/** Indica se algum filtro da gaveta foi alterado no rascunho em relação ao recorte aplicado. */
export function hasEvaluateDraftChanges(draft: EvaluateFilters, filters: EvaluateFilters): boolean {
  return (
    draft.family !== filters.family ||
    draft.version !== filters.version ||
    draft.yearFrom !== filters.yearFrom ||
    draft.yearTo !== filters.yearTo ||
    draft.maxKm !== filters.maxKm ||
    draft.origin !== filters.origin
  );
}
