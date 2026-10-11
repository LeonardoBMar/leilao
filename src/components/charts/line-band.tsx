"use client";

import { type KeyboardEvent, useState } from "react";

import { cn } from "@/lib/utils";

import { CHART_FORMATS, type ChartFormat } from "./chart-formats";
import { ChartTooltip } from "./chart-tooltip";
import { percentOf } from "./data-steps";
import { PlotFrame } from "./plot-axes";

export type LineBandPoint = {
  key: string;
  label: string;
  low: number;
  median: number;
  high: number;
  /** Dica ao passar o mouse na coluna do ponto (ex.: a faixa e a amostra). */
  tooltip?: { title: string; lines: readonly string[] };
};

type LineBandProps = {
  /** Em ordem, igualmente espaçados no eixo x. */
  points: readonly LineBandPoint[];
  yDomain: readonly [number, number];
  yTicks: readonly number[];
  format: ChartFormat;
  ariaLabel: string;
};

/**
 * Linha da mediana sobre a faixa P25–P75 (D-45): faixa em `data-1`, linha de 2 px em `data-4` e pontos com anel de
 * `surface`. Só o primeiro e o último ponto levam o valor escrito; passar o mouse na coluna de um ponto marca a coluna e
 * mostra a dica na hora; pelo teclado, as setas fazem o mesmo (os valores também estão na tabela equivalente).
 */
export function LineBand({ points, yDomain, yTicks, format, ariaLabel }: LineBandProps) {
  const formatY = CHART_FORMATS[format];
  const [active, setActive] = useState<string | null>(null);
  const xAt = (index: number) => ((index + 0.5) / points.length) * 100;
  // No SVG, y cresce para baixo.
  const yAt = (value: number) => 100 - percentOf(value, yDomain);
  const band = [
    ...points.map((point, index) => `${xAt(index)},${yAt(point.high)}`),
    ...points.toReversed().map((point, index) => `${xAt(points.length - 1 - index)},${yAt(point.low)}`),
  ].join(" ");
  const line = points.map((point, index) => `${xAt(index)},${yAt(point.median)}`).join(" ");
  const labelled = new Set([0, points.length - 1]);
  const activeIndex = points.findIndex((point) => point.key === active);
  const activePoint = points[activeIndex];

  // Teclado: setas andam entre as marcas e mostram a mesma dica do ponteiro.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = activeIndex < 0 ? (step > 0 ? 0 : points.length - 1) : activeIndex + step;
    setActive(points[Math.min(points.length - 1, Math.max(0, next))]?.key ?? null);
  }

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label="Gráfico: setas mostram cada marca."
      onKeyDown={handleKeyDown}
      onBlur={() => setActive(null)}
      className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <PlotFrame
        ariaLabel={ariaLabel}
        yDomain={yDomain}
        yTicks={yTicks.map((value) => ({ value, label: formatY(value) }))}
        xTicks={points.map((point, index) => ({ key: point.key, at: xAt(index), label: point.label }))}
      >
        {activePoint ? (
          <span
            className="pointer-events-none absolute inset-y-0 bg-surface-subtle"
            style={{ left: `${(activeIndex / points.length) * 100}%`, width: `${100 / points.length}%` }}
          />
        ) : null}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
          focusable="false"
        >
          <polygon points={band} className="fill-data-1" />
          <polyline
            points={line}
            fill="none"
            className="stroke-data-4"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {points.map((point, index) => (
          <span
            key={point.key}
            className="pointer-events-none absolute flex -translate-x-1/2 translate-y-1/2 flex-col items-center"
            style={{ left: `${xAt(index)}%`, bottom: `${percentOf(point.median, yDomain)}%` }}
          >
            <span
              className={cn(
                "rounded-full ring-2 ring-surface",
                point.key === active ? "size-3.5 bg-data-5" : "size-2.5 bg-data-4",
              )}
            />
            {labelled.has(index) || point.key === active ? (
              <span className="absolute bottom-4 text-caption leading-none font-semibold text-foreground tabular-nums">
                {formatY(point.median)}
              </span>
            ) : null}
          </span>
        ))}
        {/* Uma coluna por ponto: o alvo cobre a altura toda, então a dica não depende de acertar o ponto. */}
        {points.map((point, index) => (
          <span
            key={point.key}
            className="absolute inset-y-0 cursor-crosshair"
            style={{ left: `${(index / points.length) * 100}%`, width: `${100 / points.length}%` }}
            onPointerEnter={() => setActive(point.key)}
            onPointerLeave={() => setActive((current) => (current === point.key ? null : current))}
          />
        ))}
        {activePoint?.tooltip ? (
          <ChartTooltip
            at={xAt(activeIndex)}
            title={activePoint.tooltip.title}
            lines={activePoint.tooltip.lines}
            className="top-2"
          />
        ) : null}
      </PlotFrame>
    </div>
  );
}
