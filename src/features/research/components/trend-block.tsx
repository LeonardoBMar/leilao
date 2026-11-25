import { ChartDataTable } from "@/components/charts/chart-data-table";
import { LineBand } from "@/components/charts/line-band";
import type { ResearchFilters } from "@/domain/research/filters";
import { TREND_MIN_WEEKLY_SALES } from "@/domain/research/summary";
import { niceRange } from "@/lib/charts";
import { formatCalendarDayMonth, formatInteger, formatRatio } from "@/lib/format";

import { salesLabel } from "../labels";
import { getWeeklyTrend } from "../queries";
import { ResearchBlock } from "./research-block";

const TREND_BLOCK_TITLE = "Tendência";

/**
 * "Tendência" (D-75): a mediana semanal do % da FIPE com a faixa do meio e o `n` de cada semana. Só aparece com
 * semanas de base o bastante (`weeklyTrend`); antes disso, não ocupa lugar na tela.
 */
export async function TrendBlock({ filters }: { filters: ResearchFilters }) {
  const { weeks } = await getWeeklyTrend(filters);
  if (weeks === null) return null;
  const { domain, ticks } = niceRange(
    Math.min(...weeks.map(({ summary }) => summary.low)),
    Math.max(...weeks.map(({ summary }) => summary.high)),
  );

  return (
    <ResearchBlock
      id="pesquisa-tendencia"
      title={TREND_BLOCK_TITLE}
      description={`Mediana semanal do % da FIPE, nas semanas com ${TREND_MIN_WEEKLY_SALES} vendas ou mais.`}
    >
      <LineBand
        ariaLabel={`Mediana semanal do % da FIPE: ${weeks
          .map(
            ({ start, summary }) =>
              `semana de ${formatCalendarDayMonth(start)}, ${formatRatio(summary.median)} (${salesLabel(summary.n)})`,
          )
          .join("; ")}`}
        yDomain={domain}
        yTicks={ticks}
        format="ratio"
        points={weeks.map(({ start, summary }) => ({
          key: start.toISOString(),
          label: formatCalendarDayMonth(start),
          low: summary.low,
          median: summary.median,
          high: summary.high,
          tooltip: {
            title: `Semana de ${formatCalendarDayMonth(start)}`,
            lines: [
              `Mediana ${formatRatio(summary.median)} da FIPE`,
              `Metade entre ${formatRatio(summary.low)} e ${formatRatio(summary.high)}`,
              salesLabel(summary.n),
            ],
          },
        }))}
      />
      <ChartDataTable
        columns={[
          { key: "week", label: "Semana de" },
          { key: "sales", label: "Vendas", align: "right" },
          { key: "low", label: "25% (baixo)", align: "right" },
          { key: "median", label: "Mediana", align: "right" },
          { key: "high", label: "75% (alto)", align: "right" },
        ]}
        rows={weeks.map(({ start, summary }) => ({
          key: start.toISOString(),
          week: formatCalendarDayMonth(start),
          sales: formatInteger(summary.n),
          low: formatRatio(summary.low),
          median: formatRatio(summary.median),
          high: formatRatio(summary.high),
        }))}
      />
    </ResearchBlock>
  );
}
