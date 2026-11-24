"use client";

import { useState } from "react";

import { ActiveFilterChips } from "@/components/layout/active-filter-chips";
import { DEFAULT_EVALUATE_FILTERS, type EvaluateFilters } from "@/domain/research/evaluate";
import { vehicleLabel } from "@/domain/research/filters";

import { salesLabel } from "../labels";
import { parseEvaluateParams } from "../schemas";
import { evaluateHref } from "../search";
import type { ResearchModelOption } from "../types";
import { EvaluateFilterDrawer } from "./filters/evaluate-filter-drawer";
import {
  activeEvaluateRefinements,
  type EvaluateFacets,
  type EvaluateLotContext,
  withoutEvaluateRefinements,
} from "./filters/evaluate-filter-helpers";
import { EvaluateLotBanner, type UnlinkedLotState } from "./filters/evaluate-lot-banner";
import { ConditionSelect, FilterStatusSummary } from "./filters/research-filter-controls";
import { useResearchFilterSync } from "./filters/use-research-filter-sync";
import { ModelPicker } from "./model-picker";

export type { EvaluateFacets, EvaluateLotContext };

type EvaluateFilterBarProps = {
  /** Recorte em vigor como parâmetros (o do lote, quando a URL só traz `lote`). */
  params: Readonly<Record<string, string>>;
  models: readonly ResearchModelOption[];
  /** `null` sem modelo escolhido. */
  facets: EvaluateFacets | null;
  /** Lote que serve de alvo, se houver. */
  lotTarget: EvaluateLotContext | null;
};

/**
 * Seletor do veículo do Avaliar (docs/PLANO-MERCADO.md §5.2): alinhado ao padrão do Panorama — linha fixa com busca de
 * modelo, condição, gaveta "Refinar recorte" (família, versão FIPE, ano, km e origem com rótulos visíveis) e chips
 * removíveis abaixo. "Limpar refinamentos" preserva o modelo escolhido; trocar o modelo recomeça o recorte.
 */
export function EvaluateFilterBar({ params, models, facets, lotTarget }: EvaluateFilterBarProps) {
  const { filters, isPending, statusRef, apply } = useResearchFilterSync<EvaluateFilters>({
    params,
    parse: parseEvaluateParams,
    toHref: evaluateHref,
    rememberEvaluate: true,
  });
  const [unlinkedLot, setUnlinkedLot] = useState<UnlinkedLotState | null>(null);

  const drawerChips = facets === null || filters.vehicle === null ? [] : activeEvaluateRefinements(filters, facets);
  const conditionChanged = filters.condition !== DEFAULT_EVALUATE_FILTERS.condition;
  const totalRefinements = drawerChips.length + (conditionChanged ? 1 : 0);

  return (
    <>
      <section
        aria-label="Veículo avaliado"
        className="grid gap-3 border-b border-border bg-surface pb-3 xl:sticky xl:top-12 xl:z-30 xl:py-2.5"
      >
        <EvaluateLotBanner
          lotTarget={lotTarget}
          hasActiveLot={filters.lot !== null}
          unlinkedLot={unlinkedLot}
          onUnlinkLot={() => {
            setUnlinkedLot(null);
            apply({ ...filters, lot: null }, { focusStatus: true });
          }}
          onRestoreLot={(previous) => {
            setUnlinkedLot(null);
            apply(previous, { focusStatus: true });
          }}
          onDismissUnlinked={() => setUnlinkedLot(null)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <ModelPicker
            value={filters.vehicle === null ? null : vehicleLabel(filters.vehicle)}
            options={models}
            placeholder="Busque um modelo: onix, cg 160, hilux…"
            clearLabel="Escolher outro modelo"
            onChange={(option) => {
              if (lotTarget !== null && filters.lot !== null) {
                setUnlinkedLot({ label: lotTarget.label, previous: filters });
              } else {
                setUnlinkedLot(null);
              }
              apply({
                ...DEFAULT_EVALUATE_FILTERS,
                vehicle: option === null ? null : { brand: option.brand, model: option.model },
                condition: filters.condition,
              });
            }}
            className="w-full md:w-auto md:min-w-60 md:flex-1"
          />

          {facets === null || filters.vehicle === null ? null : (
            <>
              <ConditionSelect
                value={filters.condition}
                counts={facets.conditions}
                changed={conditionChanged}
                triggerClassName="flex-1 md:w-64 md:flex-none"
                onChange={(condition) => apply({ ...filters, condition })}
              />

              <EvaluateFilterDrawer
                filters={filters}
                facets={facets}
                activeCount={drawerChips.length}
                onApply={(next) => apply(next, { focusStatus: true })}
              />

              <FilterStatusSummary
                statusRef={statusRef}
                isPending={isPending}
                showClear={totalRefinements > 0}
                onClear={() => apply(withoutEvaluateRefinements(filters), { focusStatus: true })}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 xl:ml-2 xl:w-auto xl:shrink-0"
              >
                {filters.excluded.length > 0
                  ? `${salesLabel(facets.total)} na conta (${filters.excluded.length} ${filters.excluded.length === 1 ? "excluída" : "excluídas"})`
                  : `${salesLabel(facets.total)} no recorte`}
              </FilterStatusSummary>
            </>
          )}
        </div>
      </section>

      {drawerChips.length > 0 ? (
        <div className="-mt-3">
          <ActiveFilterChips
            chips={drawerChips}
            onRemove={(id) => {
              const chip = drawerChips.find((item) => item.id === id);
              if (chip) apply(chip.without, { focusStatus: true });
            }}
          />
        </div>
      ) : null}
    </>
  );
}
