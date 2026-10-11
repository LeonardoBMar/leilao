import { ChartDataTable } from "@/components/charts/chart-data-table";
import { LineBand } from "@/components/charts/line-band";
import type { ResearchFilters } from "@/domain/research/filters";
import { MIN_SAMPLE } from "@/domain/research/summary";
import { niceRange } from "@/lib/charts";
import { formatRatio } from "@/lib/format";

import { salesLabel } from "../labels";
import { getBidCurve, getSaleBids } from "../queries";
import { researchHref } from "../search";
import { ResearchBlock } from "./research-block";
import { SaleBidsPanel } from "./sale-bids-panel";

export const BID_CURVE_BLOCK_TITLE = "Como o lance sobe";

/**
 * "Como o lance sobe" (D-45): o lance observado como % do lance final, de 48 h a 1 h antes do fim, com a faixa do
 * meio. Responde quanto um lote ainda costuma subir depois que o usuário o vê. Com uma venda escolhida (`venda` na URL),
 * os lances dela vêm antes da curva de todas.
 */
export async function BidCurveBlock({ filters }: { filters: ResearchFilters }) {
  const [{ points }, sale] = await Promise.all([
    getBidCurve(filters),
    filters.sale === null ? Promise.resolve(null) : getSaleBids(filters.sale),
  ]);
  const [first] = points;

  return (
    <ResearchBlock
      id="pesquisa-lance"
      title={BID_CURVE_BLOCK_TITLE}
      description="Lance observado pelo coletor como % do lance final, nas horas antes do fim. A faixa clara reúne a metade do meio das vendas; a linha é a mediana."
    >
      {sale === null ? null : <SaleBidsPanel bids={sale} closeHref={researchHref({ ...filters, sale: null })} />}
      {first === undefined ? (
        <p className="text-body text-muted">
          Ainda não há {MIN_SAMPLE} vendas com lances observados antes do fim com esses filtros.
        </p>
      ) : (
        <>
          <p className="text-body font-medium text-foreground">
            {first.hours} h antes do fim, o lance estava em {formatRatio(first.summary.median)} do lance final, na
            mediana: ainda subiu {formatRatio(1 / first.summary.median - 1)} até o fim.
          </p>
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
      formatY={formatRatio}
      points={points.map(({ hours, summary }) => ({
        key: String(hours),
        label: `${hours} h`,
        low: summary.low,
        median: summary.median,
        high: summary.high,
      }))}
    />
  );
}
