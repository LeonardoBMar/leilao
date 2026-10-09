import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { type DataStep, STEP_CLASSES } from "./data-steps";

export type LegendItem = { key: string; swatch: DataStep | "few" | "empty"; label: ReactNode };

const SWATCH_CLASSES = {
  few: "bg-surface-subtle",
  empty: "border border-border-strong",
} as const;

/** Legenda da escala do mapa: um quadradinho por passo com a faixa de valores, e os casos sem cor. */
export function MapLegend({ title, items }: { title: string; items: readonly LegendItem[] }) {
  return (
    <div className="grid gap-2">
      <p className="text-caption text-muted">{title}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5 text-caption text-foreground-secondary tabular-nums">
            <span
              aria-hidden="true"
              className={cn(
                "size-3 shrink-0 rounded-sm",
                typeof item.swatch === "number" ? STEP_CLASSES[item.swatch] : SWATCH_CLASSES[item.swatch],
              )}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
