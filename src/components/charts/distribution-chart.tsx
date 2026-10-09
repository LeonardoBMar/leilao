import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

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
  /** Linha do filtro atual: rótulo em peso 600. */
  emphasis?: boolean;
};

type DistributionChartProps = {
  rows: readonly DistributionRow[];
  /** Fim do eixo (o início é zero). */
  axisMax: number;
  ticks: readonly number[];
  formatValue: (value: number) => string;
  /** Resumo em texto do gráfico inteiro, para leitores de tela. */
  ariaLabel: string;
};

/**
 * Histogramas empilhados com a mesma escala horizontal (D-45, DESIGN.md §15.8): uma faixa por grupo, barras em
 * `data-3`, faixa P25–P75 em `data-1` e mediana em tinta com o valor escrito. Cada faixa usa a própria altura máxima:
 * compara onde as vendas se concentram, e o `n` está no rótulo.
 */
export function DistributionChart({ rows, axisMax, ticks, formatValue, ariaLabel }: DistributionChartProps) {
  const domain = [0, axisMax] as const;
  return (
    <div role="img" aria-label={ariaLabel} className="grid gap-3">
      {rows.map((row) => {
        const peak = Math.max(1, ...row.bins);
        return (
          <div key={row.key} className="grid gap-1 md:grid-cols-[10rem_minmax(0,1fr)] md:items-end md:gap-4">
            <div aria-hidden="true" className="min-w-0">
              <p className={cn("truncate text-body text-foreground", row.emphasis && "font-semibold")}>{row.label}</p>
              {row.detail ? <p className="text-caption text-muted tabular-nums">{row.detail}</p> : null}
            </div>
            <div aria-hidden="true" className="relative h-14 pt-4">
              <svg
                viewBox={`0 0 ${row.bins.length} 100`}
                preserveAspectRatio="none"
                className="block h-8 w-full"
                focusable="false"
              >
                {row.bins.map((count, index) =>
                  count > 0 ? (
                    <rect
                      // A posição é a identidade da faixa.
                      key={index}
                      x={index + 0.1}
                      width={0.8}
                      y={100 - (count / peak) * 100}
                      height={(count / peak) * 100}
                      className="fill-data-3"
                    />
                  ) : null,
                )}
              </svg>
              <div className="relative mt-1 h-1.5 rounded-full bg-surface-subtle">
                {row.summary ? (
                  <span
                    className="absolute inset-y-0 rounded-full bg-data-1"
                    style={{
                      left: `${percentOf(row.summary.low, domain)}%`,
                      width: `${percentOf(row.summary.high, domain) - percentOf(row.summary.low, domain)}%`,
                    }}
                  />
                ) : null}
              </div>
              {row.summary ? (
                <span
                  className="absolute top-0 bottom-0 flex -translate-x-1/2 flex-col items-center"
                  style={{ left: `${percentOf(row.summary.median, domain)}%` }}
                >
                  <span className="text-caption leading-none font-semibold text-foreground tabular-nums">
                    {formatValue(row.summary.median)}
                  </span>
                  <span className="mt-0.5 w-0.5 flex-1 bg-foreground" />
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
      <div aria-hidden="true" className="grid md:grid-cols-[10rem_minmax(0,1fr)] md:gap-4">
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
  );
}
