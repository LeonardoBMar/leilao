import { LineBand } from "@/components/charts/line-band";
import type { ResearchFilters } from "@/domain/research/filters";
import { MIN_SAMPLE } from "@/domain/research/summary";
import { niceRange } from "@/lib/charts";
import { formatRatio } from "@/lib/format";

import { riseLabel, salesLabel } from "../labels";
import { getBidCurve } from "../queries";
import { SummaryDataTable } from "./summary-data-table";

/**
 * "Como o lance sobe" (D-45), dentro de "Como lemos os dados": o lance observado como % do lance final, de 48 h a 1 h
 * antes do fim, com a faixa do meio. Responde quanto um lote ainda costuma subir depois que o usuário o vê; a dica de
 * cada marca diz quanto falta.
 */
export async function BidCurveSection({ filters }: { filters: ResearchFilters }) {
  const { points } = await getBidCurve(filters);

  return (
    <section aria-labelledby="pesquisa-lance-titulo" className="grid min-w-0 content-start gap-4">
      <div className="grid gap-1">
        <h3 id="pesquisa-lance-titulo" className="text-heading-3 text-foreground">
          Como o lance sobe
        </h3>
        <p className="text-body text-muted">Lance visto em % do lance final.</p>
      </div>
      {points.length === 0 ? (
        <p className="text-body text-muted">
          Ainda não há {MIN_SAMPLE} vendas com lances vistos antes do fim com esses filtros.
        </p>
      ) : (
        <>
          <BidCurveChart points={points} />
          <SummaryDataTable
            labelHeading="Antes do fim"
            rows={points.map(({ hours, summary }) => ({
              key: String(hours),
              label: `${hours} h`,
              summary,
            }))}
          />
        </>
      )}
    </section>
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
