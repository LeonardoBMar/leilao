"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  /** Link interno a mais sob o gráfico (ex.: os lances da venda). */
  extraLink?: { href: Route; label: string };
  /** Ação interativa sob o gráfico (ex.: tirar ou voltar venda da conta). */
  action?: { label: string; onClick: () => void; pending?: boolean };
  /** Ponto escolhido fora do gráfico (ex.: a venda aberta): anel em tinta. */
  selected?: boolean;
  /** Pertence ao grupo em destaque: com algum ponto em destaque, os outros ficam claros. */
  highlighted?: boolean;
  /** Ponto vazado (ex.: lote aberto, que ainda não tem preço final). */
  hollow?: boolean;
  /** Fora da conta (ex.: venda excluída): mais claro. */
  muted?: boolean;
  /** Traço vertical tracejado do ponto até este y (ex.: do lance atual até a mediana do recorte). */
  guideTo?: number;
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
  /** Faixa horizontal sombreada atrás dos pontos (ex.: a faixa típica de arremate), com o rótulo à esquerda. */
  band?: { low: number; high: number; label: string };
  /** Diagonal tracejada y = x, com o rótulo no fim (ex.: limite igual ao arremate); pede `xAxis` na mesma unidade do y. */
  diagonal?: { label: string };
  /** Âncora da tabela de dados para navegação por teclado e leitores de tela. */
  tableAnchorId?: string;
  /** Rótulo do skip-link principal (padrão: "Ir para a tabela de dados"). */
  tableAnchorLabel?: string;
  /** Skip-link secundário quando o gráfico plota duas listas (ex.: lotes abertos e vendas). */
  secondaryAnchor?: { id: string; label: string };
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
  band,
  diagonal,
  tableAnchorId,
  tableAnchorLabel = "Ir para a tabela de dados",
  secondaryAnchor,
  ariaLabel,
}: ScatterPlotProps) {
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const activeKey = pinnedKey ?? hoveredKey;
  const active = points.find((point) => point.key === activeKey);

  useEffect(() => {
    if (pinnedKey === null) return;
    function unpinOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPinnedKey(null);
    }
    document.addEventListener("keydown", unpinOnEscape);
    return () => document.removeEventListener("keydown", unpinOnEscape);
  }, [pinnedKey]);
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
  // A diagonal liga os pontos em que x = y nas pontas do trecho comum aos dois eixos.
  const diagonalEnds = [Math.max(xDomain[0], yDomain[0]), Math.min(xDomain[1], yDomain[1])] as const;
  const medianLine = medians
    .toSorted((a, b) => a.x - b.x)
    .map((median) => `${percentOf(median.x, xDomain)},${100 - percentOf(median.y, yDomain)}`)
    .join(" ");
  return (
    <div className="grid gap-3">
      {tableAnchorId ? (
        <div className="flex flex-wrap gap-2">
          <a
            href={`#${tableAnchorId}`}
            className="sr-only focus:not-sr-only focus:inline-block focus:w-fit focus:rounded-md focus:bg-surface focus:px-3 focus:py-1.5 focus:text-label focus:text-accent focus:ring-2 focus:ring-accent"
          >
            {tableAnchorLabel}
          </a>
          {secondaryAnchor ? (
            <a
              href={`#${secondaryAnchor.id}`}
              className="sr-only focus:not-sr-only focus:inline-block focus:w-fit focus:rounded-md focus:bg-surface focus:px-3 focus:py-1.5 focus:text-label focus:text-accent focus:ring-2 focus:ring-accent"
            >
              {secondaryAnchor.label}
            </a>
          ) : null}
        </div>
      ) : null}
      <div onMouseLeave={() => setHoveredKey(null)}>
        <PlotFrame
          ariaLabel={ariaLabel}
          interactive
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
          {band ? (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bg-data-1/60"
              style={{
                bottom: `${percentOf(band.low, yDomain)}%`,
                height: `${percentOf(band.high, yDomain) - percentOf(band.low, yDomain)}%`,
              }}
            >
              <span className="absolute top-1 left-1 rounded-sm bg-surface/90 px-1 py-0.5 text-caption leading-none font-medium text-foreground">
                {band.label}
              </span>
            </span>
          ) : null}
          {points.flatMap((point) =>
            point.guideTo === undefined
              ? []
              : [
                  <span
                    key={`guia-${point.key}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute border-l border-dashed border-foreground/50"
                    style={{
                      left: `${percentOf(spread(point), xDomain)}%`,
                      bottom: `${percentOf(Math.min(point.y, point.guideTo), yDomain)}%`,
                      height: `${Math.abs(percentOf(point.guideTo, yDomain) - percentOf(point.y, yDomain))}%`,
                    }}
                  />,
                ],
          )}
          {reference ? (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-dashed border-border-strong"
              style={{ bottom: `${percentOf(reference.value, yDomain)}%` }}
            >
              <span className="absolute right-0 bottom-1 text-caption leading-none text-muted">{reference.label}</span>
            </span>
          ) : null}
          {diagonal && diagonalEnds[0] < diagonalEnds[1] ? (
            <>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 size-full overflow-visible"
                focusable="false"
                aria-hidden="true"
              >
                <line
                  x1={percentOf(diagonalEnds[0], xDomain)}
                  y1={100 - percentOf(diagonalEnds[0], yDomain)}
                  x2={percentOf(diagonalEnds[1], xDomain)}
                  y2={100 - percentOf(diagonalEnds[1], yDomain)}
                  className="stroke-border-strong"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -translate-x-full text-caption leading-none text-muted"
                style={{
                  left: `${percentOf(diagonalEnds[1], xDomain)}%`,
                  bottom: `${percentOf(diagonalEnds[1], yDomain)}%`,
                }}
              >
                {diagonal.label}
              </span>
            </>
          ) : null}
          {medians.length > 1 ? (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 size-full overflow-visible"
              focusable="false"
              aria-hidden="true"
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
            // Área de toque maior que o ponto; fora da ordem de tabulação, porque a tabela/lista serve ao teclado.
            <button
              key={point.key}
              type="button"
              tabIndex={-1}
              title={point.title}
              aria-label={point.title}
              onMouseEnter={() => setHoveredKey(point.key)}
              onClick={() => setPinnedKey((current) => (current === point.key ? null : point.key))}
              aria-pressed={pinnedKey === point.key}
              className="absolute flex size-11 -translate-x-1/2 translate-y-1/2 cursor-pointer items-center justify-center rounded-full outline-none transition-[left,bottom] duration-180 focus-visible:ring-2 focus-visible:ring-accent md:size-9"
              style={{ left: `${percentOf(spread(point), xDomain)}%`, bottom: `${percentOf(point.y, yDomain)}%` }}
            >
              <span
                className={cn(
                  "size-2 rounded-full ring-2 ring-surface",
                  point.key === activeKey
                    ? "size-3 bg-accent"
                    : point.hollow
                      ? "size-3 bg-surface ring-foreground"
                      : point.muted
                        ? "bg-surface ring-1 ring-border-strong"
                        : point.selected
                          ? "size-3 bg-data-5 ring-foreground"
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
              aria-hidden="true"
              className="pointer-events-none absolute h-0.5 w-5 -translate-x-1/2 translate-y-1/2 rounded-full bg-foreground transition-[left,bottom] duration-180"
              style={{ left: `${percentOf(median.x, xDomain)}%`, bottom: `${percentOf(median.y, yDomain)}%` }}
            />
          ))}
        </PlotFrame>
      </div>
      <p
        aria-live="polite"
        className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 text-label font-normal text-muted tabular-nums"
      >
        {active ? (
          <>
            <span className="text-foreground">{active.title}</span>
            {active.href ? (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={active.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center rounded-sm text-accent outline-none hover:text-accent-hover hover:underline focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Abrir anúncio
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              </>
            ) : null}
            {active.extraLink ? (
              <>
                <span aria-hidden="true">·</span>
                <Link
                  href={active.extraLink.href}
                  scroll={false}
                  className="inline-flex min-h-9 items-center rounded-sm text-accent outline-none hover:text-accent-hover hover:underline focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {active.extraLink.label}
                </Link>
              </>
            ) : null}
            {active.action ? (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  aria-busy={active.action.pending || undefined}
                  onClick={active.action.onClick}
                  className="inline-flex min-h-9 cursor-pointer items-center rounded-sm font-medium text-accent outline-none hover:text-accent-hover hover:underline focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {active.action.pending ? "Atualizando…" : active.action.label}
                </button>
              </>
            ) : null}
            {pinnedKey !== null ? (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setPinnedKey(null)}
                  className="inline-flex min-h-9 cursor-pointer items-center rounded-sm text-muted outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Desafixar
                </button>
              </>
            ) : null}
          </>
        ) : (
          "Toque ou passe o mouse num ponto para ver a venda."
        )}
      </p>
    </div>
  );
}
