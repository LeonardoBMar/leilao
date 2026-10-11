import { ChartDataTable } from "@/components/charts/chart-data-table";
import { DistributionChart } from "@/components/charts/distribution-chart";
import type { ResearchFilters } from "@/domain/research/filters";
import { ORIGIN_LABELS } from "@/features/listings/filter-labels";
import { niceTicks } from "@/lib/charts";
import { formatRatio } from "@/lib/format";

import { CONDITION_LABELS, salesLabel, summaryDetail } from "../labels";
import { getOriginDistribution } from "../queries";
import type { OriginDistribution } from "../types";
import { ResearchBlock } from "./research-block";

export const ORIGIN_BLOCK_TITLE = "De quem se compra";

type OriginRow = OriginDistribution["rows"][number];

/** "Seguradora tem a menor mediana: 38% da FIPE." Só com duas origens com base, senão não há o que comparar. */
function cheapestSentence(rows: readonly OriginRow[]): string | null {
  const based = rows.flatMap((row) =>
    row.summary.kind === "summary" && row.origin !== "outros" ? [{ ...row, median: row.summary.median }] : [],
  );
  if (based.length < 2) return null;
  const [cheapest] = based.toSorted((a, b) => a.median - b.median);
  return cheapest
    ? `${ORIGIN_LABELS[cheapest.origin]} tem a menor mediana: ${formatRatio(cheapest.median)} da FIPE.`
    : null;
}

/**
 * "De quem se compra" (docs/PLANO-MERCADO.md §6): o histograma do % da FIPE por origem inferida (banco, seguradora,
 * frota, órgão público), com todos os filtros. Origem sem venda some do gráfico; a tabela traz todas.
 */
export async function OriginBlock({ filters }: { filters: ResearchFilters }) {
  const { rows, axisMax } = await getOriginDistribution(filters);
  const shown = rows.filter((row) => row.summary.kind !== "none");
  const sentence = cheapestSentence(rows);

  return (
    <ResearchBlock
      id="pesquisa-origem"
      title={ORIGIN_BLOCK_TITLE}
      description={`Lance final em % da FIPE pela origem do veículo (${CONDITION_LABELS[filters.condition].toLowerCase()}).`}
    >
      {shown.length === 0 ? (
        <p className="text-body text-muted">Nenhuma venda com esses filtros.</p>
      ) : (
        <>
          {sentence === null ? null : <p className="text-body text-foreground">{sentence}</p>}
          <DistributionChart
            ariaLabel={`Lance final em % da FIPE por origem. ${shown
              .map((row) =>
                row.summary.kind === "summary"
                  ? `${ORIGIN_LABELS[row.origin]}: mediana ${formatRatio(row.summary.median)}, ${salesLabel(row.summary.n)}`
                  : `${ORIGIN_LABELS[row.origin]}: ${summaryDetail(row.summary)}`,
              )
              .join("; ")}.`}
            axisMax={axisMax}
            ticks={niceTicks(axisMax).filter((tick) => tick <= axisMax)}
            format="ratio"
            unit="da FIPE"
            rows={shown.map((row) => ({
              key: row.origin,
              label: ORIGIN_LABELS[row.origin],
              detail: summaryDetail(row.summary),
              bins: row.bins,
              summary:
                row.summary.kind === "summary"
                  ? { low: row.summary.low, median: row.summary.median, high: row.summary.high }
                  : null,
            }))}
          />
          <p className="text-label font-normal text-muted">
            A origem vem do comitente e do tipo de retomada que a fonte informa; sem sinal claro, fica em
            &ldquo;Outras&rdquo;.
          </p>
          <ChartDataTable
            columns={[
              { key: "origin", label: "Origem" },
              { key: "sales", label: "Vendas", align: "right" },
              { key: "low", label: "P25", align: "right" },
              { key: "median", label: "Mediana", align: "right" },
              { key: "high", label: "P75", align: "right" },
            ]}
            rows={rows.map(({ origin, summary }) => ({
              key: origin,
              origin: ORIGIN_LABELS[origin],
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
