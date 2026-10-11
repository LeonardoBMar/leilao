"use client";

import type { Route } from "next";
import Link from "next/link";
import { type MouseEvent, type ReactNode, useEffect, useState } from "react";

import { formatRatio } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ChartTooltip } from "./chart-tooltip";
import { percentOf } from "./data-steps";

export type DistributionRow = {
  key: string;
  label: ReactNode;
  /** Linha de apoio sob o rótulo (ex.: "737 vendas" ou "sem base (3 de 5)"). */
  detail?: ReactNode;
  /** Contagem por faixa, do início ao fim do eixo, em faixas de largura igual. */
  bins: readonly number[];
  /** Mediana e P25–P75; `null` sem amostra para resumir (só o histograma aparece). */
  summary: { low: number; median: number; high: number } | null;
  /** Linha do filtro atual: rótulo em peso 600 e fundo marcado. */
  emphasis?: boolean;
  /** Clicar no rótulo aplica o grupo (ex.: troca a condição do filtro). */
  href?: Route;
};

/** Formatos de valor do eixo (o gráfico é client e não recebe função). */
const FORMATS = { ratio: formatRatio } as const satisfies Record<string, (value: number) => string>;

type DistributionChartProps = {
  rows: readonly DistributionRow[];
  /** Fim do eixo (o início é zero). */
  axisMax: number;
  ticks: readonly number[];
  format: keyof typeof FORMATS;
  /** Unidade escrita na dica depois da faixa (ex.: "do mercado"). */
  unit?: string;
  /** Resumo em texto do gráfico inteiro, para leitores de tela. */
  ariaLabel: string;
};

type Cursor = { row: string; bin: number };

const ROW_GRID = "md:grid-cols-[10rem_minmax(0,1fr)] md:gap-4";

/**
 * Histogramas empilhados com a mesma escala horizontal (D-45, DESIGN.md §15.8): uma faixa por grupo, barras em
 * `data-3`, faixa P25–P75 em `data-1` e mediana em tinta com o valor escrito. Cada faixa usa a própria altura máxima:
 * compara onde as vendas se concentram, e o `n` está no rótulo.
 *
 * Passar o mouse numa faixa mostra na hora a dica (vendas na faixa, a parte do grupo e quantas saíram abaixo) e marca a
 * mesma faixa nos outros grupos; clicar fixa a faixa e escreve a comparação sob o gráfico (Esc ou outro clique solta).
 * Um só alvo por grupo acompanha o ponteiro, então a dica não pisca entre barras. O rótulo com `href` aplica o grupo.
 */
export function DistributionChart({ rows, axisMax, ticks, format, unit, ariaLabel }: DistributionChartProps) {
  const formatValue = FORMATS[format];
  const domain = [0, axisMax] as const;
  const [hover, setHover] = useState<Cursor | null>(null);
  const [pinned, setPinned] = useState<Cursor | null>(null);
  const active = hover ?? pinned;
  const binCount = Math.max(1, ...rows.map((row) => row.bins.length));
  const binWidth = axisMax / binCount;
  const rangeLabel = (bin: number) =>
    `${formatValue(bin * binWidth)} a ${formatValue((bin + 1) * binWidth)}${unit ? ` ${unit}` : ""}`;

  useEffect(() => {
    if (pinned === null) return;
    function release(event: KeyboardEvent) {
      if (event.key === "Escape") setPinned(null);
    }
    document.addEventListener("keydown", release);
    return () => document.removeEventListener("keydown", release);
  }, [pinned]);

  function binAt(event: MouseEvent<HTMLElement>): number {
    const box = event.currentTarget.getBoundingClientRect();
    const share = box.width > 0 ? (event.clientX - box.left) / box.width : 0;
    return Math.min(binCount - 1, Math.max(0, Math.floor(share * binCount)));
  }

  return (
    <div className="grid gap-3">
      <div role="img" aria-label={ariaLabel} className="grid gap-1">
        {rows.map((row) => {
          const peak = Math.max(1, ...row.bins);
          const total = row.bins.reduce((sum, count) => sum + count, 0);
          const label = (
            <>
              <span className={cn("block truncate text-body text-foreground", row.emphasis && "font-semibold")}>
                {row.label}
              </span>
              {row.detail ? <span className="block text-caption text-muted tabular-nums">{row.detail}</span> : null}
            </>
          );
          const isActiveRow = active?.row === row.key;
          return (
            <div
              key={row.key}
              className={cn(
                "grid gap-1 rounded-md px-2 py-1.5 md:items-end",
                ROW_GRID,
                row.emphasis && "bg-background",
              )}
            >
              {row.href ? (
                <Link
                  href={row.href}
                  scroll={false}
                  tabIndex={-1}
                  aria-hidden="true"
                  title="Aplicar esta condição"
                  className="group -mx-1 min-w-0 rounded-sm px-1 py-0.5 hover:bg-surface-subtle"
                >
                  {label}
                </Link>
              ) : (
                <div aria-hidden="true" className="min-w-0">
                  {label}
                </div>
              )}
              <div aria-hidden="true" className="relative h-14 pt-4">
                <svg
                  viewBox={`0 0 ${binCount} 100`}
                  preserveAspectRatio="none"
                  className="block h-8 w-full"
                  focusable="false"
                >
                  {active ? <rect x={active.bin} width={1} y={0} height={100} className="fill-surface-subtle" /> : null}
                  {row.bins.map((count, index) =>
                    count > 0 ? (
                      <rect
                        key={index}
                        x={index + 0.1}
                        width={0.8}
                        y={100 - (count / peak) * 100}
                        height={(count / peak) * 100}
                        className={active?.bin === index ? "fill-data-5" : "fill-data-3"}
                      />
                    ) : null,
                  )}
                </svg>
                <div className="relative mt-1 h-1.5 rounded-full bg-surface-subtle">
                  {row.summary ? (
                    <span
                      className="absolute inset-y-0 rounded-full bg-data-1 transition-[left,width] duration-180"
                      style={{
                        left: `${percentOf(row.summary.low, domain)}%`,
                        width: `${percentOf(row.summary.high, domain) - percentOf(row.summary.low, domain)}%`,
                      }}
                    />
                  ) : null}
                </div>
                {row.summary ? (
                  <span
                    className="pointer-events-none absolute top-0 bottom-0 flex -translate-x-1/2 flex-col items-center transition-[left] duration-180"
                    style={{ left: `${percentOf(row.summary.median, domain)}%` }}
                  >
                    <span className="text-caption leading-none font-semibold text-foreground tabular-nums">
                      {formatValue(row.summary.median)}
                    </span>
                    <span className="mt-0.5 w-0.5 flex-1 bg-foreground" />
                  </span>
                ) : null}
                {/* Alvo único da faixa: o ponteiro escolhe a faixa pela posição, sem trocar de elemento entre barras. */}
                <div
                  className="absolute inset-x-0 top-0 bottom-0 cursor-crosshair touch-none"
                  onPointerMove={(event) => setHover({ row: row.key, bin: binAt(event) })}
                  onPointerLeave={() => setHover(null)}
                  onClick={(event) => {
                    const bin = binAt(event);
                    setPinned((current) =>
                      current?.row === row.key && current.bin === bin ? null : { row: row.key, bin },
                    );
                  }}
                />
                {isActiveRow && active ? (
                  <BinTooltip
                    at={percentOf((active.bin + 0.5) * binWidth, domain)}
                    title={rangeLabel(active.bin)}
                    count={row.bins[active.bin] ?? 0}
                    total={total}
                    below={row.bins.slice(0, active.bin).reduce((sum, count) => sum + count, 0)}
                    pinned={hover === null || (pinned?.row === row.key && pinned.bin === active.bin)}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
        <div aria-hidden="true" className={cn("grid px-2", ROW_GRID)}>
          <span className="hidden md:block" />
          <div className="relative h-4 border-t border-border-strong">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute top-1 -translate-x-1/2 text-caption leading-none text-muted tabular-nums first:translate-x-0 last:-translate-x-full"
                style={{ left: `${percentOf(tick, domain)}%` }}
              >
                {formatValue(tick)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <PinnedComparison rows={rows} pinned={pinned} rangeLabel={rangeLabel} onRelease={() => setPinned(null)} />
        <DistributionLegend />
      </div>
    </div>
  );
}

/** A dica da faixa: na hora, sobre a faixa, virando para dentro perto das bordas. */
function BinTooltip({
  at,
  title,
  count,
  total,
  below,
  pinned,
}: {
  at: number;
  title: string;
  count: number;
  total: number;
  below: number;
  pinned: boolean;
}) {
  const share = (value: number) => (total === 0 ? "0%" : formatRatio(value / total));
  return (
    <ChartTooltip
      at={at}
      title={title}
      lines={[
        `${count.toLocaleString("pt-BR")} ${count === 1 ? "venda" : "vendas"} · ${share(count)} do grupo`,
        `${share(below)} saíram abaixo desta faixa`,
        pinned ? "Fixada. Clique de novo ou Esc para soltar." : "Clique para fixar e comparar.",
      ]}
      className="bottom-full mb-1"
    />
  );
}

/** Com uma faixa fixada: quantas vendas de cada grupo caíram nela, para comparar entre os grupos. */
function PinnedComparison({
  rows,
  pinned,
  rangeLabel,
  onRelease,
}: {
  rows: readonly DistributionRow[];
  pinned: Cursor | null;
  rangeLabel: (bin: number) => string;
  onRelease: () => void;
}) {
  if (pinned === null) return <span />;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label font-normal text-foreground-secondary tabular-nums">
      <span className="font-semibold text-foreground">{rangeLabel(pinned.bin)}:</span>
      {rows.map((row) => {
        const total = row.bins.reduce((sum, count) => sum + count, 0);
        const count = row.bins[pinned.bin] ?? 0;
        return (
          <span key={row.key}>
            {row.label} <span className="text-foreground">{count.toLocaleString("pt-BR")}</span>
            {total > 0 ? ` (${formatRatio(count / total)})` : ""}
          </span>
        );
      })}
      <button
        type="button"
        onClick={onRelease}
        className="rounded-sm text-accent outline-none hover:text-accent-hover hover:underline focus-visible:ring-2 focus-visible:ring-accent"
      >
        Soltar
      </button>
    </p>
  );
}

/** Legenda visual no lugar da frase "faixa clara: metade do meio; traço: mediana". */
export function DistributionLegend() {
  return (
    <ul aria-hidden="true" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted">
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-1.5 rounded-sm bg-data-3" />
        vendas por faixa
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-1.5 w-4 rounded-full bg-data-1" />
        metade do meio
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-0.5 bg-foreground" />
        mediana
      </li>
    </ul>
  );
}
