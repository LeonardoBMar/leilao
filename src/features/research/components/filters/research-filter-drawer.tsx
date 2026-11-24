"use client";

import { useState } from "react";

import { normalizeYears, type ResearchFilters } from "@/domain/research/filters";

import type { ResearchFacets } from "../../types";
import { MoreFiltersDrawer } from "./research-filter-controls";
import { activeResearchFilters, withoutResearchDrawerFilters } from "./research-filter-helpers";
import { MileageSelect, PeriodSelect, SourceSelect, StateSelect, YearSelect } from "./research-filter-selects";

/** Gaveta "Mais filtros" do Panorama: quilometragem, ano-modelo, estado, fonte e período. */
export function ResearchFilterDrawer({
  filters,
  facets,
  sourceNames,
  activeCount,
  onApply,
}: {
  filters: ResearchFilters;
  facets: ResearchFacets;
  sourceNames: Readonly<Record<string, string>>;
  activeCount: number;
  onApply: (next: ResearchFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ResearchFilters>(filters);

  const draftCount = activeResearchFilters(draft, sourceNames).length;

  return (
    <MoreFiltersDrawer
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setDraft(filters);
        setOpen(nextOpen);
      }}
      activeCount={activeCount}
      draftCount={draftCount}
      onClearDraft={() => setDraft((current) => withoutResearchDrawerFilters(current))}
      onApply={() => {
        setOpen(false);
        onApply(draft);
      }}
    >
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-caption font-semibold text-muted">Veículo</legend>
        <MileageSelect
          value={draft.maxKm}
          mileage={facets.mileage}
          onChange={(maxKm) => setDraft((current) => ({ ...current, maxKm }))}
        />
        {draft.vehicle === null ? (
          <p className="text-caption text-muted">O ano-modelo aparece com um modelo escolhido.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <YearSelect
              label="Ano-modelo de"
              short={{ empty: "Ano inicial", prefix: "De" }}
              value={draft.yearFrom}
              years={facets.years}
              onChange={(yearFrom) =>
                setDraft((current) => ({ ...current, ...normalizeYears(yearFrom, current.yearTo) }))
              }
            />
            <YearSelect
              label="Ano-modelo até"
              short={{ empty: "Ano final", prefix: "Até" }}
              value={draft.yearTo}
              years={facets.years}
              onChange={(yearTo) =>
                setDraft((current) => ({ ...current, ...normalizeYears(current.yearFrom, yearTo) }))
              }
            />
          </div>
        )}
      </fieldset>
      <fieldset className="grid gap-4 border-t border-border pt-5">
        <legend className="mb-1 text-caption font-semibold text-muted">Leilão</legend>
        <StateSelect
          value={draft.state}
          counts={facets.states}
          onChange={(state) => setDraft((current) => ({ ...current, state }))}
        />
        <SourceSelect
          value={draft.source}
          sources={facets.sources}
          onChange={(source) => setDraft((current) => ({ ...current, source }))}
        />
        {facets.periods.length > 0 || draft.period !== null ? (
          <PeriodSelect
            value={draft.period}
            periods={facets.periods}
            onChange={(period) => setDraft((current) => ({ ...current, period }))}
          />
        ) : null}
      </fieldset>
    </MoreFiltersDrawer>
  );
}
