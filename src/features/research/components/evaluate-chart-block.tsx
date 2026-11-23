import type { EvaluateFilters } from "@/domain/research/evaluate";
import { vehicleLabel } from "@/domain/research/filters";
import { formatCompactBRL, formatDate, formatDateTime } from "@/lib/format";

import { getOpenListingsFor } from "../queries";
import { evaluateHref } from "../search";
import type { EvaluationView, LotTarget } from "../types";
import { EvaluateChart } from "./evaluate-chart";
import { OPEN_LISTINGS_SHOWN } from "./evaluate-open-listings";
import { ResearchBlock } from "./research-block";

export const EVALUATE_CHART_TITLE = "Vendas e lotes abertos";

/** Gráfico do recorte com os lotes abertos (que vêm de outra consulta, por isso o bloco tem o próprio `<Suspense>`). */
export async function EvaluateChartBlock({
  filters,
  evaluation,
  lot = null,
}: {
  filters: EvaluateFilters;
  evaluation: EvaluationView;
  lot?: LotTarget | null;
}) {
  const listings = await getOpenListingsFor(filters);
  // Só os que encerram primeiro (os da lista aberta): com dezenas de abertos, o gráfico viraria uma nuvem.
  // Se o lote alvo já entra como ponto dedicado no gráfico, não o duplicamos como ponto aberto.
  const open = listings
    .slice(0, OPEN_LISTINGS_SHOWN)
    .filter((listing) => !(lot !== null && lot.currentBid !== null && listing.trackedLotId === lot.id));
  const { answer } = evaluation;
  const lotTarget =
    lot === null || (lot.maxBid === null && lot.currentBid === null)
      ? null
      : {
          label: lot.label,
          maxBid: lot.maxBid,
          currentBid: lot.currentBid,
          year: lot.target.modelYear,
          endsAt: lot.endsAt?.getTime() ?? null,
        };
  return (
    <ResearchBlock
      id="vendas"
      title={EVALUATE_CHART_TITLE}
      description={
        listings.length > open.length
          ? `Cada ponto cheio é uma venda do recorte; os vazados são os ${open.length} lotes abertos que encerram primeiro, no lance atual.`
          : "Cada ponto cheio é uma venda do recorte; os vazados são lotes abertos, no lance atual."
      }
    >
      <EvaluateChart
        subject={filters.vehicle === null ? "modelo" : vehicleLabel(filters.vehicle)}
        band={answer.kind === "band" ? { low: answer.low, median: answer.median, high: answer.high } : null}
        lotTarget={lotTarget}
        sales={evaluation.comparables.map(({ sale, excluded }) => {
          const toggled = excluded ? filters.excluded.filter((id) => id !== sale.id) : [...filters.excluded, sale.id];
          return {
            id: sale.id,
            url: sale.url,
            label: `${formatDate(sale.endsAt)} · ${sale.title} · ${formatCompactBRL(sale.finalBid)}`,
            year: sale.modelYear,
            endsAt: sale.endsAt.getTime(),
            bid: sale.finalBid,
            excluded,
            toggleHref: evaluateHref({ ...filters, excluded: toggled }),
          };
        })}
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
