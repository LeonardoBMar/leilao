import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { percentOf } from "./data-steps";

export type RangeRow = {
  key: string;
  label: ReactNode;
  low: number;
  median: number;
  high: number;
  /** Mediana formatada, à direita da barra. */
  valueLabel: string;
  /** Linha de apoio (ex.: "43 vendas"). */
  detail?: string;
  /** Amostra pequena: a faixa fica mais clara (o aviso em texto vai em `detail`). */
  faint?: boolean;
  href?: Route;
  /** Texto completo da linha para leitores de tela. */
  ariaLabel: string;
};

type RangeBarsProps = {
  rows: readonly RangeRow[];
  /** Domínio comum a todas as barras. */
  domain: readonly [number, number];
  ariaLabel: string;
  /** Marcas do eixo sobre as barras, já com o rótulo; sem elas, as barras ficam sem eixo. */
  ticks?: readonly { value: number; label: string }[];
  /** Linha vertical de referência em todas as barras (ex.: 100% do valor de mercado). */
  reference?: number;
};

const ROW_GRID =
  "grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_3rem] items-center gap-3 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_3.5rem]";

/**
 * Barras de faixa (D-45): uma linha por grupo com a faixa P25–P75 em `data-3` sobre o trilho e a mediana em tinta. Todas
 * na mesma escala, para comparar entre linhas; ao mudar os dados, a faixa e a mediana deslizam até o lugar novo.
 */
export function RangeBars({ rows, domain, ariaLabel, ticks, reference }: RangeBarsProps) {
  return (
    <div className="grid">
      {ticks ? (
        <div aria-hidden="true" className={cn(ROW_GRID, "border-b border-border-strong pb-1")}>
          <span />
          <span className="relative h-4">
            {ticks.map((tick) => (
              <span
                key={tick.value}
                className="absolute top-0 -translate-x-1/2 text-caption leading-none text-muted tabular-nums first:translate-x-0 last:-translate-x-full"
                style={{ left: `${percentOf(tick.value, domain)}%` }}
              >
                {tick.label}
              </span>
            ))}
          </span>
          <span />
        </div>
      ) : null}
      <ul aria-label={ariaLabel} className="grid">
        {rows.map((row) => {
          const content = (
            <>
              <span className="min-w-0">
                <span className="block truncate text-body text-foreground">{row.label}</span>
                {row.detail ? <span className="block text-caption text-muted tabular-nums">{row.detail}</span> : null}
              </span>
              <span aria-hidden="true" className="relative h-4">
                <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-subtle" />
                {reference === undefined ? null : (
                  <span
                    className="absolute inset-y-0 w-px -translate-x-1/2 bg-border-strong"
                    style={{ left: `${percentOf(reference, domain)}%` }}
                  />
                )}
                <span
                  className={cn(
                    "absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-data-3 transition-[left,width] duration-180",
                    row.faint && "opacity-50",
                  )}
                  style={{
                    left: `${percentOf(row.low, domain)}%`,
                    width: `${percentOf(row.high, domain) - percentOf(row.low, domain)}%`,
                  }}
                />
                <span
                  className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground transition-[left] duration-180"
                  style={{ left: `${percentOf(row.median, domain)}%` }}
                />
              </span>
              <span className="text-right text-body font-semibold text-foreground tabular-nums">{row.valueLabel}</span>
            </>
          );
          const className = cn(ROW_GRID, "border-b border-border py-2");
          return (
            <li key={row.key}>
              {row.href ? (
                <Link
                  href={row.href}
                  aria-label={row.ariaLabel}
                  scroll={false}
                  className={cn(
                    className,
                    "rounded-sm transition-colors duration-120 hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  )}
                >
                  {content}
                </Link>
              ) : (
                <div aria-label={row.ariaLabel} role="group" className={className}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
