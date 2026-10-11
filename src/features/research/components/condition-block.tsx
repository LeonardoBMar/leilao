import type { ReactNode } from "react";

import { ChartDataTable } from "@/components/charts/chart-data-table";
import { DistributionChart } from "@/components/charts/distribution-chart";
import type { ResearchFilters } from "@/domain/research/filters";
import { niceTicks } from "@/lib/charts";
import { formatRatio } from "@/lib/format";

import { CONDITION_LABELS, salesLabel, summaryDetail } from "../labels";
import { getConditionDistribution } from "../queries";
import { researchHref } from "../search";
import { ResearchBlock } from "./research-block";

export const CONDITION_BLOCK_TITLE = "Quanto se paga por condição";

/**
 * "Quanto se paga por condição" (D-45): o histograma do % da FIPE de cada condição com base, com o resto dos
 * filtros. A condição do filtro fica em destaque (a mediana dela está no resumo) e clicar noutra a aplica; as
 * condições sem base ficam só na tabela.
 */
export async function ConditionBlock({ filters, noSales }: { filters: ResearchFilters; noSales: ReactNode }) {
  const { rows, axisMax, looksMixed } = await getConditionDistribution(filters);

  return (
    <ResearchBlock id="pesquisa-condicao" title={CONDITION_BLOCK_TITLE} description="Lance final em % da FIPE.">
      {rows.every((row) => row.summary.kind === "none") ? (
        noSales
      ) : (
        <>
          <DistributionChart
            ariaLabel={`Lance final em % da FIPE por condição. ${rows
              .map((row) =>
                row.summary.kind === "summary"
                  ? `${CONDITION_LABELS[row.condition]}: mediana ${formatRatio(row.summary.median)}, ${salesLabel(row.summary.n)}`
                  : `${CONDITION_LABELS[row.condition]}: ${summaryDetail(row.summary)}`,
              )
              .join("; ")}.`}
            axisMax={axisMax}
            ticks={niceTicks(axisMax).filter((tick) => tick <= axisMax)}
            format="ratio"
            unit="da FIPE"
            // Só as condições com base (a mediana) e a do filtro; as outras ficam na tabela.
            rows={rows
              .filter((row) => row.summary.kind === "summary" || row.condition === filters.condition)
              .map((row) => ({
                key: row.condition,
                label: CONDITION_LABELS[row.condition],
                detail: summaryDetail(row.summary),
                bins: row.bins,
                summary:
                  row.summary.kind === "summary"
                    ? { low: row.summary.low, median: row.summary.median, high: row.summary.high }
                    : null,
                emphasis: row.condition === filters.condition,
                href:
                  row.condition === filters.condition
                    ? undefined
                    : researchHref({ ...filters, condition: row.condition, sale: null }),
              }))}
          />
          {looksMixed ? (
            <p className="text-label font-normal text-muted">
              Sem monta declarada inclui avariados que a fonte não classificou, por isso fica perto da pequena monta.
            </p>
          ) : null}
          <ChartDataTable
            columns={[
              { key: "condition", label: "Condição" },
              { key: "sales", label: "Vendas", align: "right" },
              { key: "low", label: "P25", align: "right" },
              { key: "median", label: "Mediana", align: "right" },
              { key: "high", label: "P75", align: "right" },
            ]}
            rows={rows.map(({ condition, summary }) => ({
              key: condition,
              condition: CONDITION_LABELS[condition],
              sales: summary.kind === "none" ? "0" : summary.n.toLocaleString("pt-BR"),
              ...(summary.kind === "summary"
                ? {
                    low: formatRatio(summary.low),
                    median: formatRatio(summary.median),
                    high: formatRatio(summary.high),
                  }
                : {}),
            }))}
          />
        </>
      )}
    </ResearchBlock>
  );
}
