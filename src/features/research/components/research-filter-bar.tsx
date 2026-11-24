"use client";

import { GitCompareArrows } from "lucide-react";
import { useId, useState } from "react";

import { ActiveFilterChips } from "@/components/layout/active-filter-chips";
import { Button } from "@/components/ui";
import {
  DEFAULT_RESEARCH_FILTERS,
  normalizeComparison,
  type ResearchFilters,
  vehicleLabel,
} from "@/domain/research/filters";

import { salesLabel } from "../labels";
import { parseResearchParams } from "../schemas";
import { researchHref } from "../search";
import type { ResearchFacets } from "../types";
import { ResearchCompareRow } from "./filters/research-compare-row";
import { CategorySelect, ConditionSelect, FilterStatusSummary } from "./filters/research-filter-controls";
import { ResearchFilterDrawer } from "./filters/research-filter-drawer";
import { activeResearchFilters, withoutResearchRefinements } from "./filters/research-filter-helpers";
import { useResearchFilterSync } from "./filters/use-research-filter-sync";
import { ModelPicker } from "./model-picker";

type ResearchFilterBarProps = {
  /** Filtros da URL na forma canônica (`researchParams`), já aplicados à tela. */
  params: Readonly<Record<string, string>>;
  facets: ResearchFacets;
};

/**
 * Barra de filtros do Panorama (DESIGN.md §15.8, docs/PLANO-MERCADO.md §6): na linha fixa, o modelo, a condição, a
 * categoria, "Mais filtros" (gaveta com estado, fonte, km, ano e, quando a base cobre, período), a comparação e o
 * total; embaixo, os filtros ativos em chips. Cada escolha aplica na hora e vai para a URL; enquanto a tela recarrega,
 * os controles já mostram a escolha.
 */
export function ResearchFilterBar({ params, facets }: ResearchFilterBarProps) {
  const { filters, isPending, statusRef, apply } = useResearchFilterSync<ResearchFilters>({
    params,
    parse: parseResearchParams,
    toHref: researchHref,
    // A comparação acompanha os filtros: outro modelo ou estado igual ao principal deixa de ser comparação. A venda
    // escolhida é de um recorte: outro filtro a fecha.
    normalize: (changed) => ({ ...changed, compare: normalizeComparison(changed, changed.compare), sale: null }),
  });

  const compareRowId = useId();
  // A linha "Comparar com" só aparece aberta pelo botão ou com uma comparação na URL.
  const [compareOpen, setCompareOpen] = useState(false);
  const showCompare = compareOpen || filters.compare !== null;
  const total = facets.conditions[filters.condition];
  const sourceNames = Object.fromEntries(facets.sources.map(({ id, name }) => [id, name]));
  const chips = activeResearchFilters(filters, sourceNames);
  const conditionChanged = filters.condition !== DEFAULT_RESEARCH_FILTERS.condition;
  const categoryChanged = filters.category !== DEFAULT_RESEARCH_FILTERS.category;
  const hasRefinements = chips.length > 0 || conditionChanged || categoryChanged || filters.compare !== null;

  return (
    <>
      <section
        aria-label="Filtros"
        className="border-b border-border bg-surface pb-3 xl:sticky xl:top-12 xl:z-30 xl:py-2.5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <ModelPicker
            value={filters.vehicle === null ? null : vehicleLabel(filters.vehicle)}
            options={facets.models}
            onChange={(option) =>
              // Os anos são de um modelo: outro modelo recomeça sem faixa.
              apply({
                ...filters,
                vehicle: option === null ? null : { brand: option.brand, model: option.model },
                yearFrom: null,
                yearTo: null,
              })
            }
            className="w-full md:w-auto md:min-w-56 md:flex-1"
          />

          <ConditionSelect
            value={filters.condition}
            counts={facets.conditions}
            changed={conditionChanged}
            triggerClassName="flex-1 md:w-60 md:flex-none"
            onChange={(condition) => apply({ ...filters, condition })}
          />

          <CategorySelect
            value={filters.category}
            counts={facets.categories}
            changed={categoryChanged}
            onChange={(category) => apply({ ...filters, category })}
          />

          <ResearchFilterDrawer
            filters={filters}
            facets={facets}
            sourceNames={sourceNames}
            activeCount={chips.length}
            onApply={(next) => apply(next, { focusStatus: true })}
          />

          <Button
            type="button"
            variant="secondary"
            className="flex-1 md:flex-none"
            aria-expanded={showCompare}
            aria-controls={compareRowId}
            onClick={() => {
              if (filters.compare !== null) {
                setCompareOpen(false);
                apply({ ...filters, compare: null });
              } else setCompareOpen((open) => !open);
            }}
          >
            <GitCompareArrows aria-hidden="true" />
            {filters.compare !== null ? "Tirar comparação" : showCompare ? "Fechar comparação" : "Comparar"}
          </Button>

          <FilterStatusSummary
            statusRef={statusRef}
            isPending={isPending}
            showClear={hasRefinements}
            onClear={() => apply(withoutResearchRefinements(filters), { focusStatus: true })}
            className="flex w-full items-center gap-3 xl:ml-2 xl:w-auto xl:shrink-0"
          >
            <span>
              {salesLabel(total)}
              <span className="sr-only"> com esses filtros</span>
            </span>
          </FilterStatusSummary>
        </div>
      </section>

      {chips.length > 0 || showCompare ? (
        <div className="-mt-3 grid gap-3">
          {chips.length > 0 ? (
            <ActiveFilterChips
              chips={chips}
              onRemove={(id) => {
                const chip = chips.find((item) => item.id === id);
                if (chip) apply(chip.without, { focusStatus: true });
              }}
            />
          ) : null}
          <ResearchCompareRow id={compareRowId} open={showCompare} filters={filters} facets={facets} onApply={apply} />
        </div>
      ) : null}
    </>
  );
}
