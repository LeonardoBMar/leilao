import { BRAZIL_MAP_CREDIT } from "@/components/charts/brazil-geometry";
import { BrazilMap } from "@/components/charts/brazil-map";
import { ChartDataTable } from "@/components/charts/chart-data-table";
import { DistributionChart } from "@/components/charts/distribution-chart";
import { MapLegend } from "@/components/charts/map-legend";
import { LinkTabs, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { effectiveMetric, type ResearchFilters, vehicleLabel } from "@/domain/research/filters";
import { STATE_NAMES } from "@/domain/research/states";
import { niceTicks } from "@/lib/charts";
import { formatBRL, formatDate, formatRatio } from "@/lib/format";

import { formatMetric, METRIC_LABELS, salesLabel, summaryDetail } from "../labels";
import { getStateDetail, getStateMap } from "../queries";
import { researchHref } from "../search";
import { stateMapRegions } from "../state-regions";
import type { StateDetail } from "../types";
import { NoSales, ResearchBlock } from "./research-block";

export const STATE_BLOCK_TITLE = "Por estado";

/**
 * "Por estado" (D-45): mapa do Brasil com a mediana de cada UF e, com um estado escolhido, o detalhe ao lado (abaixo
 * no celular). Com um modelo escolhido, a medida pode ser o lance final em R$.
 */
export async function StateBlock({ filters, since }: { filters: ResearchFilters; since: Date | null }) {
  const [map, detail] = await Promise.all([getStateMap(filters), getStateDetail(filters)]);
  const { regions, legend, legendTitle } = stateMapRegions(map, filters);
  const subject = filters.vehicle === null ? "" : ` do ${vehicleLabel(filters.vehicle)}`;
  const description =
    map.metric === "ratio"
      ? `Mediana do lance final${subject} em % do valor de mercado, por estado. Passe o mouse para ver os números e clique num estado para comparar com o Brasil.`
      : `Mediana do lance final${subject} em R$, por estado. Passe o mouse para ver os números e clique num estado para comparar com o Brasil.`;
  const withSales = map.states.filter(({ summary }) => summary.kind !== "none");

  return (
    <ResearchBlock
      id="pesquisa-estado"
      title={STATE_BLOCK_TITLE}
      description={description}
      actions={
        filters.vehicle === null ? null : (
          <LinkTabs
            label="Medida do mapa"
            tabs={(["ratio", "price"] as const).map((metric) => ({
              href: researchHref({ ...filters, metric }),
              label: metric === "ratio" ? "% do mercado" : "Lance em R$",
              active: effectiveMetric(filters) === metric,
            }))}
          />
        )
      }
    >
      {withSales.length === 0 ? (
        <NoSales since={since} />
      ) : (
        <>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
            <div className="grid w-full max-w-lg content-start gap-4">
              <BrazilMap
                ariaLabel={`Mapa do Brasil: mediana ${METRIC_LABELS[map.metric]} por estado`}
                regions={regions}
              />
              <MapLegend title={legendTitle} items={legend} />
              <p className="text-caption text-muted-subtle">{BRAZIL_MAP_CREDIT}</p>
            </div>
            <StateDetailPanel detail={detail} />
          </div>
          <ChartDataTable
            columns={[
              { key: "state", label: "Estado" },
              { key: "sales", label: "Vendas", align: "right" },
              { key: "low", label: "P25", align: "right" },
              { key: "median", label: "Mediana", align: "right" },
              { key: "high", label: "P75", align: "right" },
            ]}
            rows={withSales
              .toSorted(
                (a, b) => (b.summary.kind === "none" ? 0 : b.summary.n) - (a.summary.kind === "none" ? 0 : a.summary.n),
              )
              .map(({ state, summary }) => ({
                key: state,
                state: STATE_NAMES[state],
                sales: summary.kind === "none" ? "0" : summary.n.toLocaleString("pt-BR"),
                ...(summary.kind === "summary"
                  ? {
                      low: formatMetric(map.metric, summary.low),
                      median: formatMetric(map.metric, summary.median),
                      high: formatMetric(map.metric, summary.high),
                    }
                  : {}),
              }))}
          />
        </>
      )}
    </ResearchBlock>
  );
}

/** Detalhe do estado escolhido: distribuição frente à do Brasil, fontes e, com poucas vendas, cada uma. */
function StateDetailPanel({ detail }: { detail: StateDetail | null }) {
  if (detail === null) {
    return (
      <p className="self-center text-body text-muted lg:max-w-sm">
        Escolha um estado no mapa para ver como ele se compara com o Brasil e de quais fontes vêm as vendas.
      </p>
    );
  }
  const name = STATE_NAMES[detail.state];
  if (detail.sales === 0) {
    return <p className="text-body text-muted">Nenhuma venda em {name} com esses filtros.</p>;
  }
  const rows = [
    { key: "state", label: name, distribution: detail.distribution, emphasis: true },
    { key: "brasil", label: "Brasil", distribution: detail.national, emphasis: false },
  ];

  return (
    <section aria-labelledby="pesquisa-estado-detalhe" className="grid min-w-0 content-start gap-4">
      <div className="grid gap-1">
        <h3 id="pesquisa-estado-detalhe" className="text-heading-3 text-foreground">
          {name}
        </h3>
        <p className="text-label font-normal text-muted">
          {salesLabel(detail.sales)}: {detail.sources.map((source) => `${source.name} ${source.sales}`).join(", ")}
        </p>
      </div>
      <DistributionChart
        ariaLabel={`${name} comparado com o Brasil, em % do valor de mercado. ${rows
          .map(({ label, distribution: { summary } }) =>
            summary.kind === "summary"
              ? `${label}: mediana ${formatRatio(summary.median)}, ${salesLabel(summary.n)}`
              : `${label}: ${summaryDetail(summary)}`,
          )
          .join("; ")}.`}
        axisMax={detail.axisMax}
        ticks={niceTicks(detail.axisMax).filter((tick) => tick <= detail.axisMax)}
        formatValue={formatRatio}
        rows={rows.map(({ key, label, distribution: { summary, bins }, emphasis }) => ({
          key,
          label,
          detail: summaryDetail(summary),
          bins,
          summary: summary.kind === "summary" ? { low: summary.low, median: summary.median, high: summary.high } : null,
          emphasis,
        }))}
      />
      {detail.few.length > 0 ? (
        <div className="grid gap-2">
          <h4 className="text-label text-foreground">As vendas uma a uma</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead className="text-right">Lance final</TableHead>
                <TableHead className="text-right">% do mercado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.few.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="tabular-nums">{formatDate(sale.endsAt)}</TableCell>
                  <TableCell className="max-w-64">
                    <a
                      href={sale.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-2 text-accent hover:text-accent-hover hover:underline"
                    >
                      {sale.title}
                    </a>
                    <span className="text-caption text-muted">
                      {[sale.city, sale.modelYear, sale.source].filter(Boolean).join(" · ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(sale.finalBid)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {sale.ratio === null ? "—" : formatRatio(sale.ratio)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  );
}
