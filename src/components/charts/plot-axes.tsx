import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { percentOf } from "./data-steps";

type PlotFrameProps = {
  /** Marcas do eixo vertical: valor (posição no domínio) e rótulo. */
  yTicks: readonly { value: number; label: string }[];
  yDomain: readonly [number, number];
  /** Rótulos do eixo horizontal, com a posição em % (`at`) a partir da esquerda; `minor` some abaixo de `sm`. */
  xTicks: readonly { key: string; at: number; label: string; minor?: boolean }[];
  ariaLabel: string;
  /** Quando `children` contém controles focáveis (ex.: botões no `ScatterPlot`), evita `role="img"` + `aria-hidden` sobre eles. */
  interactive?: boolean;
  children: ReactNode;
};

/**
 * Moldura comum da dispersão e da linha (D-45): rótulos do eixo y à esquerda, grade horizontal em `border` e rótulos do
 * eixo x embaixo, em HTML para o texto não escalar com o SVG. O conteúdo ocupa a área de plotagem (`relative`).
 */
export function PlotFrame({ yTicks, yDomain, xTicks, ariaLabel, interactive = false, children }: PlotFrameProps) {
  return (
    <div
      role={interactive ? "group" : "img"}
      aria-label={ariaLabel}
      className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2"
    >
      <div aria-hidden="true" className="relative h-52 min-w-10">
        {yTicks.map((tick) => (
          <span
            key={tick.value}
            className="absolute right-0 translate-y-1/2 text-caption leading-none text-muted tabular-nums"
            style={{ bottom: `${percentOf(tick.value, yDomain)}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      <div aria-hidden={interactive ? undefined : true} className="relative h-52 border-b border-border-strong">
        {yTicks.map((tick) => (
          <span
            key={tick.value}
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-border"
            style={{ bottom: `${percentOf(tick.value, yDomain)}%` }}
          />
        ))}
        {children}
      </div>
      <span />
      <div aria-hidden="true" className="relative h-5">
        {xTicks.map((tick) => (
          <span
            key={tick.key}
            className={cn(
              "absolute top-1.5 -translate-x-1/2 text-caption leading-none whitespace-nowrap text-muted tabular-nums",
              tick.minor && "hidden sm:block",
            )}
            style={{ left: `${tick.at}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
