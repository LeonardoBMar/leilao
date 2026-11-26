import { ChartDataTable } from "@/components/charts/chart-data-table";
import type { GroupSummary } from "@/domain/research/summary";
import { formatInteger, formatRatio } from "@/lib/format";

export type SummaryDataRow = {
  key: string;
  label: string;
  summary: GroupSummary;
};

/** Tabela acessível padrão dos blocos de resumo do Panorama (grupo, vendas, P25, mediana e P75). */
export function SummaryDataTable({
  labelHeading,
  rows,
  formatValue = formatRatio,
}: {
  labelHeading: string;
  rows: readonly SummaryDataRow[];
  formatValue?: (value: number) => string;
}) {
  return (
    <ChartDataTable
      columns={[
        { key: "label", label: labelHeading },
        { key: "sales", label: "Vendas", align: "right" },
        { key: "low", label: "25% (baixo)", align: "right" },
        { key: "median", label: "Mediana", align: "right" },
        { key: "high", label: "75% (alto)", align: "right" },
      ]}
      rows={rows.map(({ key, label, summary }) => ({
        key,
        label,
        sales: summary.kind === "none" ? "0" : formatInteger(summary.n),
        ...(summary.kind === "summary"
          ? {
              low: formatValue(summary.low),
              median: formatValue(summary.median),
              high: formatValue(summary.high),
            }
          : {}),
      }))}
    />
  );
}
