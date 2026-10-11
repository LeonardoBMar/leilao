import type { EvaluateFilters } from "@/domain/research/evaluate";
import { vehicleLabel } from "@/domain/research/filters";
import { formatCompactBRL, formatDate, formatDateTime } from "@/lib/format";

import { getOpenListingsFor } from "../queries";
import type { EvaluationView } from "../types";
import { EvaluateChart } from "./evaluate-chart";
import { ResearchBlock } from "./research-block";

export const EVALUATE_CHART_TITLE = "Vendas e lotes abertos";

/** Gráfico do recorte com os lotes abertos (que vêm de outra consulta, por isso o bloco tem o próprio `<Suspense>`). */
export async function EvaluateChartBlock({
  filters,
  evaluation,
}: {
  filters: EvaluateFilters;
  evaluation: EvaluationView;
}) {
  const open = await getOpenListingsFor(filters);
  const { answer } = evaluation;
  return (
    <ResearchBlock
      id="vendas"
      title={EVALUATE_CHART_TITLE}
      description="Cada ponto cheio é uma venda do recorte; os vazados são lotes abertos, no lance atual."
    >
      <EvaluateChart
        subject={filters.vehicle === null ? "modelo" : vehicleLabel(filters.vehicle)}
        band={answer.kind === "band" ? { low: answer.low, median: answer.median, high: answer.high } : null}
        sales={evaluation.comparables.map(({ sale, excluded }) => ({
          id: sale.id,
          url: sale.url,
          label: `${formatDate(sale.endsAt)} · ${sale.title} · ${formatCompactBRL(sale.finalBid)}`,
          year: sale.modelYear,
          endsAt: sale.endsAt.getTime(),
          bid: sale.finalBid,
          excluded,
        }))}
        open={open.flatMap((listing) =>
          listing.currentBid === null
            ? []
            : [
                {
                  id: listing.id,
                  url: listing.url,
                  label: `${listing.title} · lance ${formatCompactBRL(listing.currentBid)}${
                    listing.endsAt === null ? "" : ` · encerra ${formatDateTime(listing.endsAt)}`
                  }`,
                  year: listing.modelYear,
                  endsAt: listing.endsAt?.getTime() ?? null,
                  bid: listing.currentBid,
                },
              ],
        )}
      />
    </ResearchBlock>
  );
}
