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
  href?: Route;
  /** Texto completo da linha para leitores de tela. */
  ariaLabel: string;
};

type RangeBarsProps = {
  rows: readonly RangeRow[];
  /** Domínio comum a todas as barras. */
  domain: readonly [number, number];
  ariaLabel: string;
};

/**
 * Barras de faixa (D-45): uma linha por grupo com a faixa P25–P75 em `data-3` sobre o trilho e a mediana em tinta. Todas
 * na mesma escala, para comparar entre linhas.
 */
export function RangeBars({ rows, domain, ariaLabel }: RangeBarsProps) {
  return (
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
              <span
                className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-data-3"
                style={{
                  left: `${percentOf(row.low, domain)}%`,
                  width: `${percentOf(row.high, domain) - percentOf(row.low, domain)}%`,
                }}
              />
              <span
                className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground"
                style={{ left: `${percentOf(row.median, domain)}%` }}
              />
            </span>
            <span className="text-right text-body font-semibold text-foreground tabular-nums">{row.valueLabel}</span>
          </>
        );
        const className =
          "grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_3rem] items-center gap-3 border-b border-border py-2 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_3.5rem]";
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
  );
}
