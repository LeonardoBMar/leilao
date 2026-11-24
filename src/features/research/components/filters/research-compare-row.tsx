"use client";

import { AnimatePresence, m } from "motion/react";

import { type ResearchFilters, vehicleLabel } from "@/domain/research/filters";
import { MOTION_ENTER_TRANSITION, MOTION_EXIT_TRANSITION } from "@/lib/motion";

import type { ResearchFacets } from "../../types";
import { ModelPicker } from "../model-picker";
import { CompareStateSelect } from "./research-filter-selects";

/** Linha "Comparar com" do Panorama: outro modelo (quando já há um escolhido) e/ou outro estado. */
export function ResearchCompareRow({
  id,
  open,
  filters,
  facets,
  onApply,
}: {
  id: string;
  open: boolean;
  filters: ResearchFilters;
  facets: ResearchFacets;
  onApply: (next: ResearchFilters) => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <m.div
          key="compare-row"
          id={id}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0, transition: MOTION_ENTER_TRANSITION }}
          exit={{ opacity: 0, y: -6, transition: MOTION_EXIT_TRANSITION }}
          className="grid gap-3 md:flex md:flex-wrap md:items-center"
        >
          <span className="text-label text-muted">Comparar com</span>
          {filters.vehicle === null ? null : (
            <ModelPicker
              label="Comparar com outro modelo"
              placeholder="Outro modelo"
              shortcut={false}
              clearLabel="Tirar o modelo da comparação"
              value={filters.compare?.vehicle ? vehicleLabel(filters.compare.vehicle) : null}
              options={facets.models.filter(
                (option) => option.brand !== filters.vehicle?.brand || option.model !== filters.vehicle.model,
              )}
              onChange={(option) =>
                onApply({
                  ...filters,
                  compare: {
                    vehicle: option === null ? null : { brand: option.brand, model: option.model },
                    state: filters.compare?.state ?? null,
                  },
                })
              }
              className="md:min-w-64 md:flex-1"
            />
          )}
          <CompareStateSelect
            value={filters.compare?.state ?? null}
            current={filters.state}
            counts={facets.states}
            onChange={(state) => onApply({ ...filters, compare: { vehicle: filters.compare?.vehicle ?? null, state } })}
          />
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
