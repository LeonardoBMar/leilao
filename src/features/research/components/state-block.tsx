import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { BRAZIL_MAP_CREDIT } from "@/components/charts/brazil-geometry";
import { BrazilMap } from "@/components/charts/brazil-map";
import { DistributionChart } from "@/components/charts/distribution-chart";
import { MapLegend } from "@/components/charts/map-legend";
import { RangeBars } from "@/components/charts/range-bars";
import { LinkTabs, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { effectiveMetric, type ResearchFilters } from "@/domain/research/filters";
import { STATE_NAMES } from "@/domain/research/states";
import { MIN_SAMPLE } from "@/domain/research/summary";
import { niceTicks } from "@/lib/charts";
import { formatBRL, formatDate, formatRatio } from "@/lib/format";

import { formatMetric, METRIC_LABELS, salesLabel, summaryDetail } from "../labels";
import { getStateDetail, getStateMap, getWhereView } from "../queries";
import { researchHref } from "../search";
import { stateMapRegions, stateRangeRows, whereRangeRows } from "../state-regions";
import type { StateDetail } from "../types";
import { ResearchBlock } from "./research-block";
import { SummaryDataTable } from "./summary-data-table";

export const STATE_BLOCK_TITLE = "Onde";

/**
 * "Onde" (docs/PLANO-MERCADO.md §6): a mediana por faixa de distância de São Carlos e por estado e fonte, em barras de
 * faixa numa escala comum; o mapa do Brasil (D-46) fica atrás de "Ver no mapa", aberto quando há estado escolhido,
 * com o detalhe do estado ao lado (abaixo no celular). Com um modelo escolhido, a medida pode ser o lance final em R$.
 */
export async function StateBlock({ filters, noSales }: { filters: ResearchFilters; noSales: ReactNode }) {
  const [map, detail, where] = await Promise.all([
    getStateMap(filters),
    getStateDetail(filters),
    getWhereView(filters),
  ]);
  const { regions, legend, legendTitle } = stateMapRegions(map, filters);
  const withSales = map.states.filter(({ summary }) => summary.kind !== "none");
  const list = stateRangeRows(map, filters);
  const bands = whereRangeRows(where, filters);
  const mapPanel = (
    <>
      <BrazilMap ariaLabel={`Mapa do Brasil: mediana ${METRIC_LABELS[map.metric]} por estado`} regions={regions} />
      <MapLegend title={legendTitle} items={legend} />
      <p className="text-caption text-muted">{BRAZIL_MAP_CREDIT}</p>
    </>
  );

  return (
    <ResearchBlock
      id="pesquisa-estado"
      title={STATE_BLOCK_TITLE}
      actions={
        filters.vehicle === null ? null : (
          <LinkTabs
            label="Medida do mapa"
            tabs={(["ratio", "price"] as const).map((metric) => ({
              href: researchHref({ ...filters, metric, sale: null }),
              label: metric === "ratio" ? "% da FIPE" : "Lance em R$",
              active: effectiveMetric(filters) === metric,
            }))}
          />
        )
      }
    >
      {withSales.length === 0 ? (
        noSales
      ) : (
        <>
          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="pesquisa-onde-distancia" className="grid min-w-0 content-start gap-3">
              <h3 id="pesquisa-onde-distancia" className="text-heading-3 text-foreground">
                Distância de {where.regionLabel}{" "}
                <span className="text-caption font-normal text-muted">(região-base)</span>
              </h3>
              {bands.distance.length === 0 ? (
                <p className="text-body text-muted">Poucas vendas em cada faixa para uma mediana.</p>
              ) : (
                <RangeBars
                  ariaLabel={`Mediana por distância de ${where.regionLabel}: ${bands.distance.map((row) => row.ariaLabel).join("; ")}`}
                  domain={bands.domain}
                  rows={bands.distance}
                />
              )}
              <p className="text-label font-normal text-muted">
                Em linha reta até a cidade do pátio; de estrada é mais.
                {bands.unknownDistance > 0 ? ` ${salesLabel(bands.unknownDistance)} sem a cidade identificada.` : ""}
              </p>
            </section>
            <section aria-labelledby="pesquisa-onde-fonte" className="grid min-w-0 content-start gap-3">
              <h3 id="pesquisa-onde-fonte" className="text-heading-3 text-foreground">
                Estado e fonte
              </h3>
              {bands.places.length === 0 ? (
                <p className="text-body text-muted">Nenhum estado e fonte com {MIN_SAMPLE} vendas ou mais.</p>
              ) : (
                <RangeBars
                  ariaLabel={`Mediana por estado e fonte, das que mais vendem: ${bands.places.map((row) => row.ariaLabel).join("; ")}`}
                  domain={bands.domain}
                  rows={bands.places}
                />
              )}
              {bands.otherPlaces > 0 ? (
                <p className="text-label font-normal text-muted">
                  Mais {bands.otherPlaces} {bands.otherPlaces === 1 ? "par" : "pares"} de estado e fonte com menos
                  vendas.
                </p>
              ) : null}
            </section>
          </div>
          <details open={filters.state !== null} className="group">
            <summary className="inline-flex min-h-10 w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm text-label text-accent outline-none hover:text-accent-hover hover:underline focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
              <ChevronDown
                aria-hidden="true"
                className="size-4 transition-transform duration-150 group-open:rotate-180"
              />
              <span className="hidden md:inline">Ver no mapa</span>
              <span className="md:hidden">Ver por estado</span>
            </summary>
            <div className="mt-4 grid gap-6">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
                {/* Mapa a partir de `md`; no celular, a lista de estados, com o mapa a um toque (siglas espremidas não se leem). */}
                <div className="hidden w-full max-w-lg content-start gap-4 md:grid">{mapPanel}</div>
                <div className="grid content-start gap-4 md:hidden">
                  <div className="grid gap-1">
                    <p className="text-caption text-muted">{legendTitle}</p>
                    <RangeBars
                      ariaLabel={`Estados do menor para o maior valor: ${list.rows.map((row) => `${row.label} ${row.valueLabel}`).join(", ")}`}
                      domain={list.domain}
                      rows={list.rows}
                    />
                  </div>
                  {list.few.length > 0 ? (
                    <p className="text-label font-normal text-muted">
                      Poucas vendas para uma mediana:{" "}
                      {list.few.map(({ state, sales }) => `${STATE_NAMES[state]} (${sales})`).join(", ")}.
                    </p>
                  ) : null}
                  <details className="group">
                    <summary className="inline-flex min-h-10 w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm text-label text-accent outline-none hover:text-accent-hover hover:underline focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                      <ChevronDown
                        aria-hidden="true"
                        className="size-4 transition-transform duration-150 group-open:rotate-180"
                      />
                      Ver o mapa
                    </summary>
                    <div className="mt-3 grid content-start gap-4">{mapPanel}</div>
                  </details>
                </div>
                <StateDetailPanel detail={detail} />
              </div>
              <SummaryDataTable
                labelHeading="Estado"
                formatValue={(value) => formatMetric(map.metric, value)}
                rows={withSales
                  .toSorted(
                    (a, b) =>
                      (b.summary.kind === "none" ? 0 : b.summary.n) - (a.summary.kind === "none" ? 0 : a.summary.n),
                  )
                  .map(({ state, summary }) => ({
                    key: state,
                    label: STATE_NAMES[state],
                    summary,
                  }))}
              />
            </div>
          </details>
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
        Escolha um estado no mapa para compará-lo com o Brasil.
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
        ariaLabel={`${name} comparado com o Brasil, em % da FIPE. ${rows
          .map(({ label, distribution: { summary } }) =>
            summary.kind === "summary"
              ? `${label}: mediana ${formatRatio(summary.median)}, ${salesLabel(summary.n)}`
              : `${label}: ${summaryDetail(summary)}`,
          )
          .join("; ")}.`}
        axisMax={detail.axisMax}
        ticks={niceTicks(detail.axisMax).filter((tick) => tick <= detail.axisMax)}
        format="ratio"
        unit="da FIPE"
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
                <TableHead className="text-right">% da FIPE</TableHead>
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
