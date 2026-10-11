import type { MapRegion } from "@/components/charts/brazil-map";
import { toDataStep } from "@/components/charts/data-steps";
import type { LegendItem } from "@/components/charts/map-legend";
import type { RangeRow } from "@/components/charts/range-bars";
import type { ResearchFilters } from "@/domain/research/filters";
import { STATE_NAMES, type StateCode } from "@/domain/research/states";
import { isSmallSample, MIN_SAMPLE, ratioAxisMax, SMALL_SAMPLE } from "@/domain/research/summary";
import { sequentialScale } from "@/lib/charts";
import { formatRatio } from "@/lib/format";

import { formatMetric, salesLabel, smallSampleLabel } from "./labels";
import { researchHref } from "./search";
import type { StateMapView } from "./types";

/** Passos da escala do mapa (`data-1` a `data-5`). */
const MAP_STEPS = 5;

const thousands = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/**
 * Valor escrito no mapa e na legenda: "47%" ou, em lance final, os milhares de reais ("38,9"), porque "R$ 38,9 mil"
 * não cabe nos estados pequenos. O título da legenda diz a unidade; a dica e os leitores de tela levam o valor completo.
 */
function mapValue(metric: StateMapView["metric"], value: number): string {
  return metric === "ratio" ? formatRatio(value) : thousands.format(value / 100_000);
}

/**
 * Estados e legenda do mapa (D-45): cor pela mediana só com amostra mínima; com 1 a 4 vendas, só a contagem; sem venda,
 * só o contorno. Cada estado com venda é um link que escolhe a UF (ou a limpa, se já é a escolhida).
 */
export function stateMapRegions(
  view: StateMapView,
  filters: ResearchFilters,
): { regions: MapRegion[]; legend: LegendItem[]; legendTitle: string } {
  const medians = view.states.flatMap(({ summary }) => (summary.kind === "summary" ? [summary.median] : []));
  const scale = sequentialScale(medians, MAP_STEPS);
  const format = (value: number) => formatMetric(view.metric, value);
  const measure = view.metric === "ratio" ? "da FIPE" : "de lance final";
  const action = (selected: boolean) => (selected ? "Clique para voltar ao Brasil" : "Clique para ver o detalhe");

  const regions = view.states.map(({ state, summary }): MapRegion => {
    const name = STATE_NAMES[state];
    const selected = filters.state === state;
    // Outro estado é outro recorte: a venda aberta fecha.
    const href = researchHref({ ...filters, state: selected ? null : state, sale: null });
    if (summary.kind === "summary") {
      const small = isSmallSample(summary.n);
      return {
        state,
        selected,
        // O asterisco marca a amostra pequena sem tirar o número (a legenda explica).
        value: `${mapValue(view.metric, summary.median)}${small ? "*" : ""}`,
        tone: { kind: "colored", step: toDataStep(scale?.step(summary.median) ?? 3) },
        href,
        ariaLabel: `${name}: mediana ${format(summary.median)} ${measure}, ${smallSampleLabel(summary.n)}`,
        tooltip: {
          title: name,
          lines: [
            `Mediana ${format(summary.median)} ${measure}`,
            `Metade das vendas entre ${format(summary.low)} e ${format(summary.high)}`,
            smallSampleLabel(summary.n),
            action(selected),
          ],
        },
      };
    }
    if (summary.kind === "few") {
      return {
        state,
        selected,
        // Entre parênteses, para a contagem não passar por mediana (a legenda explica).
        value: `(${summary.n})`,
        tone: { kind: "few" },
        href,
        ariaLabel: `${name}: ${salesLabel(summary.n)}, poucas para uma mediana`,
        tooltip: {
          title: name,
          lines: [`${salesLabel(summary.n)}: poucas para uma mediana`, action(selected)],
        },
      };
    }
    return {
      state,
      selected,
      tone: { kind: "empty" },
      href: selected ? href : undefined,
      ariaLabel: `${name}: nenhuma venda`,
      tooltip: { title: name, lines: ["Nenhuma venda com esses filtros"] },
    };
  });

  const usedSteps = new Set(regions.flatMap(({ tone }) => (tone.kind === "colored" ? [tone.step] : [])));
  const bands = (scale?.bands ?? []).flatMap((band) => {
    const step = toDataStep(band.step);
    if (!usedSteps.has(step)) return [];
    const [from, to] = [mapValue(view.metric, band.from), mapValue(view.metric, band.to)];
    return [{ key: String(step), swatch: step, label: from === to ? from : `${from}–${to}` }];
  });
  const legend: LegendItem[] = [
    ...bands,
    ...(view.states.some(({ summary }) => summary.kind === "summary" && isSmallSample(summary.n))
      ? [
          {
            key: "small",
            swatch: "small" as const,
            label: `amostra pequena (${MIN_SAMPLE} a ${SMALL_SAMPLE - 1} vendas)`,
          },
        ]
      : []),
    { key: "few", swatch: "few", label: `(n) 1 a ${MIN_SAMPLE - 1} vendas` },
    { key: "empty", swatch: "empty", label: "nenhuma venda" },
  ];
  const legendTitle = view.metric === "ratio" ? "Mediana em % da FIPE" : "Mediana do lance final, em milhares de R$";
  return { regions, legend, legendTitle };
}

/** Estado com poucas vendas, que a lista cita sem mediana. */
export type FewSalesState = { state: StateCode; sales: number };

/**
 * Os estados como lista (celular, no lugar do mapa): barras de faixa da menor para a maior mediana, na escala comum,
 * com o link que escolhe a UF. Estados com poucas vendas ficam fora das barras e saem à parte.
 */
export function stateRangeRows(
  view: StateMapView,
  filters: ResearchFilters,
): { rows: RangeRow[]; domain: readonly [number, number]; few: FewSalesState[] } {
  const summaries = view.states.flatMap(({ state, summary }) =>
    summary.kind === "summary" ? [{ state, summary }] : [],
  );
  const measure = view.metric === "ratio" ? "da FIPE" : "de lance final";
  const rows = summaries
    .toSorted((a, b) => a.summary.median - b.summary.median || b.summary.n - a.summary.n)
    .map(({ state, summary }): RangeRow => {
      const name = STATE_NAMES[state];
      const selected = filters.state === state;
      return {
        key: state,
        label: name,
        low: summary.low,
        median: summary.median,
        high: summary.high,
        valueLabel: mapValue(view.metric, summary.median),
        detail: smallSampleLabel(summary.n),
        faint: isSmallSample(summary.n),
        href: researchHref({ ...filters, state: selected ? null : state, sale: null }),
        ariaLabel: `${name}: mediana ${formatMetric(view.metric, summary.median)} ${measure}, ${smallSampleLabel(summary.n)}`,
      };
    });
  const highest = Math.max(0, ...rows.map((row) => row.high));
  const domain = [0, view.metric === "ratio" ? ratioAxisMax(highest) : highest] as const;
  const few = view.states.flatMap(({ state, summary }) =>
    summary.kind === "few" ? [{ state, sales: summary.n }] : [],
  );
  return { rows, domain, few };
}
