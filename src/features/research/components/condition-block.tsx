import type { ReactNode } from "react";

import { ChartDataTable } from "@/components/charts/chart-data-table";
import { DistributionChart } from "@/components/charts/distribution-chart";
import type { ResearchFilters } from "@/domain/research/filters";
import { niceTicks } from "@/lib/charts";
import { formatRatio } from "@/lib/format";

import { belowMarketLabel, CONDITION_LABELS, salesLabel, summaryDetail } from "../labels";
import { getConditionDistribution } from "../queries";
import { ResearchBlock } from "./research-block";

export const CONDITION_BLOCK_TITLE = "Quanto se paga por condição";

/**
 * "Quanto se paga por condição" (D-45): o histograma do % do valor de mercado de cada condição, com o resto dos
 * filtros. A condição do filtro fica em destaque e vira a frase de apoio; as vendas fora do % são ditas no resumo.
 */
export async function ConditionBlock({ filters, noSales }: { filters: ResearchFilters; noSales: ReactNode }) {
  const { rows, axisMax, looksMixed } = await getConditionDistribution(filters);
  const selected = rows.find((row) => row.condition === filters.condition)?.summary;
  const headline =
    selected?.kind === "summary"
      ? `${CONDITION_LABELS[filters.condition]}: mediana de ${formatRatio(selected.median)}, ou ${belowMarketLabel(selected.median)} (${salesLabel(selected.n)}).`
      : null;

  return (
    <ResearchBlock
      id="pesquisa-condicao"
      title={CONDITION_BLOCK_TITLE}
      description="Lance final como % do valor de mercado (da fonte ou da tabela FIPE casado pelo sistema). A faixa clara reúne a metade do meio das vendas; o traço é a mediana."
    >
      {rows.every((row) => row.summary.kind === "none") ? (
        noSales
      ) : (
        <>
          {headline ? <p className="text-body font-medium text-foreground">{headline}</p> : null}
          <DistributionChart
            ariaLabel={`Lance final em % do valor de mercado por condição. ${rows
              .map((row) =>
                row.summary.kind === "summary"
                  ? `${CONDITION_LABELS[row.condition]}: mediana ${formatRatio(row.summary.median)}, ${salesLabel(row.summary.n)}`
                  : `${CONDITION_LABELS[row.condition]}: ${summaryDetail(row.summary)}`,
              )
              .join("; ")}.`}
            axisMax={axisMax}
            ticks={niceTicks(axisMax).filter((tick) => tick <= axisMax)}
            formatValue={formatRatio}
            // Condição sem venda só aparece se é a do filtro; a tabela traz todas.
            rows={rows
              .filter((row) => row.summary.kind !== "none" || row.condition === filters.condition)
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
              }))}
          />
          {looksMixed ? (
            <p className="text-label font-normal text-muted">
              Sem monta declarada inclui veículos que a fonte não classificou: por isso a mediana fica perto da de
              pequena monta.
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
