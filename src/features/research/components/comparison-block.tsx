import type { ReactNode } from "react";

import { ChartDataTable } from "@/components/charts/chart-data-table";
import { DistributionChart } from "@/components/charts/distribution-chart";
import type { ResearchFilters } from "@/domain/research/filters";
import { niceTicks } from "@/lib/charts";
import { formatRatio } from "@/lib/format";

import { smallSampleLabel, summaryDetail } from "../labels";
import { getComparison } from "../queries";
import type { ComparisonView } from "../types";
import { ResearchBlock } from "./research-block";

export const COMPARISON_BLOCK_TITLE = "Comparação";

/** A diferença das medianas em pontos percentuais, dita sem recomendar nada. */
function differenceSentence([first, second]: ComparisonView["groups"]): string | null {
  const [a, b] = [first?.distribution.summary, second?.distribution.summary];
  if (first === undefined || second === undefined || a?.kind !== "summary" || b?.kind !== "summary") return null;
  const points = Math.round(Math.abs(a.median - b.median) * 100);
  const lower = a.median < b.median ? first : second;
  if (points === 0) return `${first.label} e ${second.label} têm medianas que diferem em menos de 1 ponto percentual.`;
  return `${lower.label} saiu ${points} ${points === 1 ? "ponto percentual" : "pontos percentuais"} mais abaixo do valor de mercado, na mediana.`;
}

/**
 * "Comparação" (D-61): a distribuição do % do valor de mercado de dois grupos na mesma escala — dois modelos ou dois
 * estados, com a condição, a categoria e o resto dos filtros iguais. Só descreve: medianas, amostras e a diferença.
 */
export async function ComparisonBlock({ filters, noSales }: { filters: ResearchFilters; noSales: ReactNode }) {
  const view = await getComparison(filters);
  if (view === null) return null;
  const { groups, axisMax } = view;
  const sentence = differenceSentence(groups);

  return (
    <ResearchBlock
      id="pesquisa-comparacao"
      title={COMPARISON_BLOCK_TITLE}
      description="Lance final em % do valor de mercado; o resto dos filtros vale para os dois grupos."
    >
      {groups.every(({ distribution }) => distribution.summary.kind === "none") ? (
        noSales
      ) : (
        <>
          {sentence ? <p className="text-body font-medium text-foreground">{sentence}</p> : null}
          <DistributionChart
            ariaLabel={`${groups[0]?.label} comparado com ${groups[1]?.label}, em % do valor de mercado. ${groups
              .map(({ label, distribution: { summary } }) =>
                summary.kind === "summary"
                  ? `${label}: mediana ${formatRatio(summary.median)}, ${smallSampleLabel(summary.n)}`
                  : `${label}: ${summaryDetail(summary)}`,
              )
              .join("; ")}.`}
            axisMax={axisMax}
            ticks={niceTicks(axisMax).filter((tick) => tick <= axisMax)}
            formatValue={formatRatio}
            rows={groups.map(({ label, distribution: { summary, bins } }, index) => ({
              key: String(index),
              label,
              detail: summaryDetail(summary),
              bins,
              summary:
                summary.kind === "summary" ? { low: summary.low, median: summary.median, high: summary.high } : null,
              emphasis: index === 0,
            }))}
          />
          <ChartDataTable
            columns={[
              { key: "group", label: "Grupo" },
              { key: "sales", label: "Vendas", align: "right" },
              { key: "low", label: "P25", align: "right" },
              { key: "median", label: "Mediana", align: "right" },
              { key: "high", label: "P75", align: "right" },
            ]}
            rows={groups.map(({ label, distribution: { summary } }, index) => ({
              key: String(index),
              group: label,
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
