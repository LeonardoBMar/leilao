import { ChartDataTable } from "@/components/charts/chart-data-table";
import { LineBand } from "@/components/charts/line-band";
import type { ResearchFilters } from "@/domain/research/filters";
import { MIN_SAMPLE } from "@/domain/research/summary";
import { niceRange } from "@/lib/charts";
import { formatRatio } from "@/lib/format";

import { riseLabel, salesLabel } from "../labels";
import { getBidCurve } from "../queries";
import { ResearchBlock } from "./research-block";

export const BID_CURVE_BLOCK_TITLE = "Como o lance sobe";

/**
 * "Como o lance sobe" (D-45): o lance observado como % do lance final, de 48 h a 1 h antes do fim, com a faixa do
 * meio. Responde quanto um lote ainda costuma subir depois que o usuário o vê; a dica de cada marca diz quanto falta.
 */
export async function BidCurveBlock({ filters }: { filters: ResearchFilters }) {
  const { points } = await getBidCurve(filters);

  return (
    <ResearchBlock id="pesquisa-lance" title={BID_CURVE_BLOCK_TITLE} description="Lance visto em % do lance final.">
      {points.length === 0 ? (
        <p className="text-body text-muted">
          Ainda não há {MIN_SAMPLE} vendas com lances vistos antes do fim com esses filtros.
        </p>
      ) : (
        <>
          <BidCurveChart points={points} />
          <ChartDataTable
            columns={[
              { key: "hours", label: "Antes do fim" },
              { key: "sales", label: "Vendas", align: "right" },
              { key: "low", label: "P25", align: "right" },
              { key: "median", label: "Mediana", align: "right" },
              { key: "high", label: "P75", align: "right" },
            ]}
            rows={points.map(({ hours, summary }) => ({
              key: String(hours),
              hours: `${hours} h`,
              sales: summary.n.toLocaleString("pt-BR"),
              low: formatRatio(summary.low),
              median: formatRatio(summary.median),
              high: formatRatio(summary.high),
            }))}
          />
        </>
      )}
    </ResearchBlock>
  );
}

function BidCurveChart({ points }: { points: Awaited<ReturnType<typeof getBidCurve>>["points"] }) {
  const { domain, ticks } = niceRange(
    Math.min(...points.map(({ summary }) => summary.low)),
    Math.max(1, ...points.map(({ summary }) => summary.high)),
  );
  return (
    <LineBand
      ariaLabel={`Lance antes do fim como % do lance final: ${points
        .map(({ hours, summary }) => `${hours} h, mediana ${formatRatio(summary.median)} (${salesLabel(summary.n)})`)
        .join("; ")}`}
      yDomain={domain}
      yTicks={ticks}
      format="ratio"
      points={points.map(({ hours, summary }) => ({
        key: String(hours),
        label: `${hours} h`,
        low: summary.low,
        median: summary.median,
        high: summary.high,
        tooltip: {
          title: `${hours} h antes do fim`,
          lines: [
            `Mediana ${formatRatio(summary.median)} do lance final`,
            `Até o fim: ${riseLabel(summary.median)}`,
            `Metade entre ${formatRatio(summary.low)} e ${formatRatio(summary.high)}`,
            salesLabel(summary.n),
          ],
        },
      }))}
    />
  );
}
