import type { Route } from "next";

import { BrazilMap, type MapRegion } from "@/components/charts/brazil-map";
import { ChartDataTable } from "@/components/charts/chart-data-table";
import { DistributionChart } from "@/components/charts/distribution-chart";
import { LineBand } from "@/components/charts/line-band";
import { MapLegend } from "@/components/charts/map-legend";
import { RangeBars } from "@/components/charts/range-bars";
import { ScatterPlot } from "@/components/charts/scatter-plot";
import { STATE_NAMES } from "@/domain/research/states";
import { formatRatio } from "@/lib/format";

/** Gráficos da Pesquisa (D-45) com dados de exemplo próximos da medição de 08/10/2026. */
const bins = (peaks: Record<number, number>) => Array.from({ length: 50 }, (_, index) => peaks[index] ?? 0);

const SAMPLE_REGIONS: MapRegion[] = (
  [
    { state: "SP", value: "43%", tone: { kind: "colored", step: 2 }, selected: true },
    { state: "GO", value: "56%", tone: { kind: "colored", step: 4 }, selected: false },
    { state: "CE", value: "51%", tone: { kind: "colored", step: 3 }, selected: false },
    { state: "DF", value: "61%", tone: { kind: "colored", step: 5 }, selected: false },
    { state: "PR", value: "35%", tone: { kind: "colored", step: 1 }, selected: false },
    { state: "PE", value: "48%", tone: { kind: "colored", step: 3 }, selected: false },
    { state: "MT", value: "2", tone: { kind: "few" }, selected: false },
    { state: "AC", tone: { kind: "empty" }, selected: false },
  ] satisfies Pick<MapRegion, "state" | "value" | "tone" | "selected">[]
).map((region) => ({
  ...region,
  href: "/componentes" as Route,
  ariaLabel: STATE_NAMES[region.state],
  tooltip: { title: STATE_NAMES[region.state], lines: [region.value ?? "nenhuma venda"] },
}));

export function ChartShowcase() {
  return (
    <section aria-labelledby="charts-title" className="grid gap-8">
      <h2 id="charts-title" className="text-heading-3">
        Gráficos (Pesquisa)
      </h2>

      <div className="grid gap-3">
        <h3 className="text-label text-muted">DistributionChart</h3>
        <DistributionChart
          ariaLabel="Exemplo de distribuição por condição"
          axisMax={1}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          formatValue={formatRatio}
          rows={[
            {
              key: "sem-monta",
              label: "Sem monta declarada",
              detail: "737 vendas",
              bins: bins({
                15: 8,
                17: 20,
                19: 41,
                20: 66,
                21: 80,
                22: 92,
                23: 88,
                24: 85,
                25: 70,
                26: 52,
                27: 40,
                29: 25,
                31: 10,
              }),
              summary: { low: 0.41, median: 0.49, high: 0.57 },
              emphasis: true,
            },
            {
              key: "media",
              label: "Média monta",
              detail: "48 vendas",
              bins: bins({ 14: 2, 16: 5, 18: 9, 20: 12, 22: 8, 24: 6, 26: 4, 28: 2 }),
              summary: { low: 0.33, median: 0.4, high: 0.47 },
            },
            {
              key: "grande",
              label: "Grande monta",
              detail: "sem base (3 de 5)",
              bins: bins({ 12: 1, 15: 2 }),
              summary: null,
            },
          ]}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] md:gap-8">
        <div className="grid gap-3">
          <h3 className="text-label text-muted">BrazilMap e MapLegend</h3>
          <BrazilMap ariaLabel="Exemplo de mapa do Brasil" regions={SAMPLE_REGIONS} />
          <MapLegend
            title="Mediana em % do valor de mercado"
            items={[
              { key: "1", swatch: 1, label: "35–40%" },
              { key: "2", swatch: 2, label: "40–45%" },
              { key: "3", swatch: 3, label: "45–51%" },
              { key: "4", swatch: 4, label: "51–56%" },
              { key: "5", swatch: 5, label: "56–61%" },
              { key: "few", swatch: "few", label: "1 a 4 vendas" },
              { key: "empty", swatch: "empty", label: "nenhuma venda" },
            ]}
          />
        </div>
        <div className="grid content-start gap-3">
          <h3 className="text-label text-muted">RangeBars</h3>
          <RangeBars
            ariaLabel="Exemplo de ranking"
            domain={[0, 1]}
            rows={[
              {
                key: "207",
                label: "Peugeot 207",
                low: 0.2,
                median: 0.21,
                high: 0.21,
                valueLabel: "21%",
                detail: "5 vendas",
              },
              {
                key: "fiesta",
                label: "Ford Fiesta",
                low: 0.32,
                median: 0.38,
                high: 0.52,
                valueLabel: "38%",
                detail: "20 vendas",
              },
              {
                key: "hb20",
                label: "Hyundai HB20",
                low: 0.53,
                median: 0.6,
                high: 0.69,
                valueLabel: "60%",
                detail: "22 vendas",
              },
            ].map((row) => ({
              ...row,
              href: "/componentes" as Route,
              ariaLabel: `${row.label}: mediana ${row.valueLabel}`,
            }))}
          />
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="grid gap-3">
          <h3 className="text-label text-muted">ScatterPlot</h3>
          <ScatterPlot
            ariaLabel="Exemplo de dispersão"
            xValues={[2016, 2017, 2018, 2019, 2020]}
            yDomain={[0, 60_000]}
            yTicks={[0, 20_000, 40_000, 60_000].map((value) => ({ value, label: `${value / 1000} mil` }))}
            points={[
              [2016, 21_000],
              [2016, 24_500],
              [2017, 26_000],
              [2018, 29_000],
              [2018, 31_500],
              [2018, 27_200],
              [2019, 35_000],
              [2020, 41_000],
              [2020, 38_500],
            ].map(([x = 0, y = 0], index) => ({ key: String(index), x, y, title: `${x}: R$ ${y}` }))}
            medians={[
              { x: 2016, y: 22_750 },
              { x: 2018, y: 29_000 },
              { x: 2020, y: 39_750 },
            ]}
          />
        </div>
        <div className="grid gap-3">
          <h3 className="text-label text-muted">LineBand</h3>
          <LineBand
            ariaLabel="Exemplo de curva do lance"
            yDomain={[0.8, 1]}
            yTicks={[0.8, 0.9, 1]}
            formatY={formatRatio}
            points={[
              { key: "48", label: "48 h", low: 0.86, median: 0.93, high: 0.97 },
              { key: "24", label: "24 h", low: 0.91, median: 0.96, high: 0.98 },
              { key: "12", label: "12 h", low: 0.94, median: 0.97, high: 0.99 },
              { key: "6", label: "6 h", low: 0.95, median: 0.98, high: 0.99 },
              { key: "3", label: "3 h", low: 0.96, median: 0.98, high: 1 },
              { key: "1", label: "1 h", low: 0.97, median: 0.99, high: 1 },
            ]}
          />
        </div>
      </div>

      <ChartDataTable
        columns={[
          { key: "state", label: "Estado" },
          { key: "median", label: "Mediana", align: "right" },
          { key: "n", label: "Vendas", align: "right" },
        ]}
        rows={[
          { key: "SP", state: "São Paulo", median: "43%", n: "297" },
          { key: "AC", state: "Acre", n: "0" },
        ]}
      />
    </section>
  );
}
