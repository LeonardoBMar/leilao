"use client";

import { useSyncExternalStore } from "react";

import { ButtonLink } from "@/components/ui";
import { DEFAULT_EVALUATE_FILTERS } from "@/domain/research/evaluate";
import { vehicleLabel } from "@/domain/research/filters";

import { recentModelsServerSnapshot, recentModelsSnapshot, subscribeRecentModels } from "../recent-models";
import { evaluateHref } from "../search";

/** Modelos buscados por último neste navegador (D-62), como atalhos do Avaliar. Sem nenhum, nada. */
export function RecentModelLinks() {
  const recent = useSyncExternalStore(subscribeRecentModels, recentModelsSnapshot, recentModelsServerSnapshot);
  if (recent.length === 0) return null;
  return (
    <section aria-labelledby="entrada-recentes" className="grid gap-2">
      <h3 id="entrada-recentes" className="text-label text-foreground">
        Buscados por último
      </h3>
      <div className="flex flex-wrap gap-2">
        {recent.map((vehicle) => (
          <ButtonLink
            key={`${vehicle.brand}|${vehicle.model}`}
            href={evaluateHref({ ...DEFAULT_EVALUATE_FILTERS, vehicle })}
            variant="secondary"
            size="sm"
          >
            {vehicleLabel(vehicle)}
          </ButtonLink>
        ))}
      </div>
    </section>
  );
}
