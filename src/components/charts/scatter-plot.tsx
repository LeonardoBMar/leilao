"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { percentOf } from "./data-steps";
import { PlotFrame } from "./plot-axes";

export type ScatterPoint = {
  key: string;
  x: number;
  y: number;
  /** Texto da venda: dica nativa do ponto e linha escrita sob o gráfico quando o ponto é escolhido. */
  title: string;
  /** Link da venda, oferecido sob o gráfico junto do texto. */
  href?: string;
  /** Pertence ao grupo em destaque: com algum ponto em destaque, os outros ficam claros. */
  highlighted?: boolean;
};

/** Eixo x contínuo (km): domínio e marcas escolhidos por quem chama. */
export type ContinuousAxis = { domain: readonly [number, number]; ticks: readonly { value: number; label: string }[] };

type ScatterPlotProps = {
  points: readonly ScatterPoint[];
  /** Mediana de cada valor de x, desenhada como traço em tinta. */
  medians?: readonly { x: number; y: number }[];
  /** Valores inteiros de x (anos), um rótulo para cada; os pontos do mesmo valor se espalham. */
  xValues?: readonly number[];
  /** Eixo x contínuo, no lugar de `xValues`: os pontos ficam onde caem. */
  xAxis?: ContinuousAxis;
  yDomain: readonly [number, number];
  /** Marcas do eixo y já com o rótulo escrito (o gráfico é client e não recebe função). */
  yTicks: readonly { value: number; label: string }[];
  /** Linha horizontal tracejada de referência, com o rótulo à direita (ex.: 100% do valor de mercado). */
  reference?: { value: number; label: string };
  ariaLabel: string;
};

/** Rótulos do eixo x que cabem no celular. */
const MOBILE_X_LABELS = 7;

/** Meia largura da coluna de um x usada para espalhar pontos do mesmo x, sem invadir a vizinha. */
const SPREAD = 0.3;

/**
 * Dispersão com x discreto (ano-modelo) e y contínuo (D-45). Pontos do mesmo x se espalham na horizontal, em ordem,
 * para não se esconderem; cada ponto tem anel de `surface` para separar sobreposições. Passar o mouse ou tocar num ponto
 * escreve a venda sob o gráfico (sem depender do hover); para teclado e leitor de tela vale a tabela das vendas.
 */
export function ScatterPlot({
  points,
  medians = [],
  xValues = [],
  xAxis,
  yDomain,
  yTicks,
  reference,
  ariaLabel,
}: ScatterPlotProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = points.find((point) => point.key === activeKey);
  const first = Math.min(...xValues);
  const last = Math.max(...xValues);
  const xDomain = xAxis?.domain ?? ([first - 0.5, last + 0.5] as const);
  const labelEvery = Math.ceil(xValues.length / MOBILE_X_LABELS);
  const anyHighlighted = points.some((point) => point.highlighted);
  const byX = Map.groupBy(points, (point) => point.x);
  const spread = (point: ScatterPoint) => {
    const group = byX.get(point.x) ?? [point];
    if (xAxis) return point.x;
    if (group.length === 1) return point.x;
    return point.x - SPREAD + (2 * SPREAD * group.indexOf(point)) / (group.length - 1);
  };
  // Medianas ligadas na ordem do x: a tendência por ano aparece sem esconder os pontos.
  const medianLine = medians
    .toSorted((a, b) => a.x - b.x)
    .map((median) => `${percentOf(median.x, xDomain)},${100 - percentOf(median.y, yDomain)}`)
    .join(" ");
  return (
    <div className="grid gap-3">
      <PlotFrame
        ariaLabel={ariaLabel}
        yDomain={yDomain}
        yTicks={yTicks}
        xTicks={
          xAxis
            ? xAxis.ticks.map(({ value, label }) => ({ key: String(value), at: percentOf(value, xDomain), label }))
            : xValues.map((value, index) => ({
                key: String(value),
                at: percentOf(value, xDomain),
                label: String(value),
                // No celular cabem uns 7 anos: os outros rótulos somem, contando do último (o mais novo fica).
                minor: (xValues.length - 1 - index) % labelEvery !== 0,
              }))
        }
      >
        {reference ? (
          <span
            className="absolute inset-x-0 border-t border-dashed border-border-strong"
            style={{ bottom: `${percentOf(reference.value, yDomain)}%` }}
          >
            <span className="absolute right-0 bottom-1 text-caption leading-none text-muted">{reference.label}</span>
          </span>
        ) : null}
        {medians.length > 1 ? (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 size-full overflow-visible"
            focusable="false"
          >
            <polyline
              points={medianLine}
              fill="none"
              className="stroke-foreground"
              strokeOpacity={0.5}
              strokeWidth={1.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}
        {points.map((point) => (
          // Área de toque maior que o ponto; fora da ordem de tabulação, porque o gráfico é só para ver (a tabela serve ao teclado).
          <button
            key={point.key}
            type="button"
            tabIndex={-1}
            title={point.title}
            aria-label={point.title}
            onMouseEnter={() => setActiveKey(point.key)}
            onClick={() => setActiveKey((current) => (current === point.key ? null : point.key))}
            className="absolute flex size-6 -translate-x-1/2 translate-y-1/2 cursor-pointer items-center justify-center transition-[left,bottom] duration-180"
            style={{ left: `${percentOf(spread(point), xDomain)}%`, bottom: `${percentOf(point.y, yDomain)}%` }}
          >
            <span
              className={cn(
                "size-2 rounded-full ring-2 ring-surface",
                point.key === activeKey
                  ? "size-3 bg-accent"
                  : anyHighlighted
                    ? point.highlighted
                      ? "size-3 bg-data-5"
                      : "bg-data-1"
                    : "bg-data-3",
              )}
            />
          </button>
        ))}
        {medians.map((median) => (
          <span
            key={median.x}
            className="pointer-events-none absolute h-0.5 w-5 -translate-x-1/2 translate-y-1/2 rounded-full bg-foreground transition-[left,bottom] duration-180"
            style={{ left: `${percentOf(median.x, xDomain)}%`, bottom: `${percentOf(median.y, yDomain)}%` }}
          />
        ))}
      </PlotFrame>
      <p className="min-h-5 text-label font-normal text-muted tabular-nums">
        {active ? (
          <>
            <span className="text-foreground">{active.title}</span>
            {active.href ? (
              <>
                {" · "}
                <a
                  href={active.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent-hover hover:underline"
                >
                  Abrir anúncio
                </a>
              </>
            ) : null}
          </>
        ) : (
          "Passe o mouse ou toque num ponto para ver a venda."
        )}
      </p>
    </div>
  );
}
