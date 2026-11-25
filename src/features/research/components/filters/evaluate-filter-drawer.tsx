"use client";

import { useState } from "react";

import { VEHICLE_ORIGINS } from "@/domain/listings/origin";
import { type EvaluateFilters } from "@/domain/research/evaluate";
import { normalizeYears, RESEARCH_MILEAGE_OPTIONS } from "@/domain/research/filters";
import { ORIGIN_LABELS } from "@/lib/listing-filter-labels";

import { mileageLabel } from "../../labels";
import {
  activeEvaluateRefinements,
  type EvaluateFacets,
  hasEvaluateDraftChanges,
  withoutEvaluateDrawerFilters,
} from "./evaluate-filter-helpers";
import { DrawerSelect, MoreFiltersDrawer } from "./research-filter-controls";

/** Gaveta "Mais filtros" do Avaliar: família, versão FIPE, ano-modelo, quilometragem e origem. */
export function EvaluateFilterDrawer({
  filters,
  facets,
  activeCount,
  onApply,
}: {
  filters: EvaluateFilters;
  facets: EvaluateFacets;
  activeCount: number;
  onApply: (next: EvaluateFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EvaluateFilters>(filters);

  const draftCount = draft.vehicle === null ? 0 : activeEvaluateRefinements(draft, facets).length;
  const draftChanged = hasEvaluateDraftChanges(draft, filters);

  return (
    <MoreFiltersDrawer
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setDraft(filters);
        setOpen(nextOpen);
      }}
      activeCount={activeCount}
      draftCount={draftCount}
      onClearDraft={() => setDraft((current) => withoutEvaluateDrawerFilters(current))}
      onApply={() => {
        setOpen(false);
        onApply(draft);
      }}
    >
      {draftChanged ? (
        <p role="status" className="rounded-md bg-surface-subtle px-3 py-2 text-caption text-muted">
          As contagens refletem o recorte atual e serão atualizadas ao clicar em Aplicar.
        </p>
      ) : null}
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-caption font-semibold text-muted">Veículo</legend>
        {facets.families.length > 0 || draft.family !== null ? (
          <DrawerSelect
            label="Família"
            hint="Agrupa carrocerias ou submodelos da mesma linha (ex.: Onix Plus)."
            allLabel="Todas as famílias"
            value={draft.family}
            options={facets.families}
            allowZero={draftChanged}
            onChange={(family) => setDraft((current) => ({ ...current, family, version: null }))}
          />
        ) : null}

        {facets.versions.length > 0 || draft.version !== null ? (
          <DrawerSelect
            label="Versão FIPE"
            hint="Acabamento, motor e câmbio exatos da tabela FIPE."
            allLabel="Todas as versões"
            value={draft.version}
            options={facets.versions}
            allowZero={draftChanged}
            onChange={(version) => setDraft((current) => ({ ...current, version }))}
          />
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <DrawerSelect
            label="Ano-modelo de"
            allLabel="Ano inicial"
            value={draft.yearFrom === null ? null : String(draft.yearFrom)}
            options={facets.years.map(({ year, n }) => ({ value: String(year), label: `De ${year}`, n }))}
            allowZero={draftChanged}
            onChange={(year) =>
              setDraft((current) => ({
                ...current,
                ...normalizeYears(year === null ? null : Number(year), current.yearTo),
              }))
            }
          />
          <DrawerSelect
            label="Ano-modelo até"
            allLabel="Ano final"
            value={draft.yearTo === null ? null : String(draft.yearTo)}
            options={facets.years.map(({ year, n }) => ({
              value: String(year),
              label: `Até ${year}`,
              n,
            }))}
            allowZero={draftChanged}
            onChange={(year) =>
              setDraft((current) => ({
                ...current,
                ...normalizeYears(current.yearFrom, year === null ? null : Number(year)),
              }))
            }
          />
        </div>

        <DrawerSelect
          label="Quilometragem máxima"
          allLabel="Qualquer km"
          value={draft.maxKm === null ? null : String(draft.maxKm)}
          options={RESEARCH_MILEAGE_OPTIONS.map((km) => ({
            value: String(km),
            label: `Até ${mileageLabel(km)}`,
          }))}
          onChange={(km) =>
            setDraft((current) => ({
              ...current,
              maxKm: RESEARCH_MILEAGE_OPTIONS.find((option) => String(option) === km) ?? null,
            }))
          }
        />
      </fieldset>

      <fieldset className="grid gap-4 border-t border-border pt-5">
        <legend className="mb-1 text-caption font-semibold text-muted">Leilão</legend>
        <DrawerSelect
          label="Origem"
          allLabel="Qualquer origem"
          value={draft.origin}
          options={VEHICLE_ORIGINS.map((origin) => ({
            value: origin,
            label: ORIGIN_LABELS[origin],
            n: facets.origins[origin],
          }))}
          allowZero={draftChanged}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              origin: VEHICLE_ORIGINS.find((key) => key === value) ?? null,
            }))
          }
        />
      </fieldset>
    </MoreFiltersDrawer>
  );
}
