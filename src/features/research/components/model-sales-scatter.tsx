"use client";

import { useId, useState } from "react";

import { ScatterPlot } from "@/components/charts/scatter-plot";
import {
  SegmentedControl,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { cents } from "@/domain/money";
import { ratioAxisMax } from "@/domain/research/summary";
import { niceTicks } from "@/lib/charts";
import { formatCompactBRL, formatRatio } from "@/lib/format";

import { salesLabel } from "../labels";
import {
  highlightOptions,
  isInHighlight,
  kmAxis,
  NO_HIGHLIGHT,
  type ScatterSale,
  type ScatterXAxis,
  type ScatterYAxis,
} from "../scatter-view";

type ModelSalesScatterProps = {
  sales: readonly ScatterSale[];
  /** Mediana de cada ano-modelo com amostra (só no eixo do ano), em lance final (centavos) e em % da FIPE. */
  medians: Readonly<Record<ScatterYAxis, readonly { x: number; y: number }[]>>;
  /** Nome do modelo, para o resumo em texto do gráfico. */
  subject: string;
  /** Resumo em texto do gráfico por ano-modelo (as medianas de cada ano). */
  yearSummary: string;
  /** Venda com os lances abertos, marcada no gráfico. */
  selectedSale: string | null;
};

/**
 * Dispersão das vendas do modelo (D-45) com duas leituras que explicam por que dois pontos do mesmo ano ficam longe: o
 * eixo pode ser o ano-modelo ou o km, e um estado ou uma fonte pode ser destacado. O destaque usa os tons já existentes
 * (ponto escuro sobre os claros), sem uma cor por categoria.
 */
export function ModelSalesScatter({ sales, medians, subject, yearSummary, selectedSale }: ModelSalesScatterProps) {
  const [axis, setAxis] = useState<ScatterXAxis>("year");
  const [measure, setMeasure] = useState<ScatterYAxis>("price");
  const [highlight, setHighlight] = useState(NO_HIGHLIGHT);
  const highlightLabelId = useId();
  const options = highlightOptions(sales);
  const chosen = [...options.states, ...options.sources].find((option) => option.value === highlight);

  const plotted = sales.flatMap((sale) => {
    const x = axis === "year" ? sale.year : sale.km;
    const y = measure === "price" ? sale.finalBid : sale.ratio;
    return x === null || y === null ? [] : [{ sale, x, y }];
  });
  const missing = sales.length - plotted.length;
  const ratioMax = ratioAxisMax(Math.max(0, ...plotted.map(({ y }) => y)));
  const yTicks =
    measure === "price"
      ? niceTicks(Math.max(0, ...plotted.map(({ y }) => y))).map((value) => ({
          value,
          label: formatCompactBRL(cents(value)),
        }))
      : niceTicks(ratioMax)
          .filter((value) => value <= ratioMax)
          .map((value) => ({ value, label: formatRatio(value) }));
  const yEnd = measure === "price" ? (yTicks.at(-1)?.value ?? 1) : ratioMax;
  const points = plotted.map(({ sale, x, y }) => ({
    key: sale.id,
    x,
    y,
    title: sale.label,
    href: sale.url,
    extraLink: sale.bidsHref === null ? undefined : { href: sale.bidsHref, label: "Ver lances" },
    selected: sale.id === selectedSale,
    highlighted: isInHighlight(sale, highlight),
  }));

  const xs = plotted.map(({ x }) => x);
  const [firstYear, lastYear] = [Math.min(...xs), Math.max(...xs)];
  const xValues =
    axis === "year" && xs.length > 0 ? Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i) : [];
  const xAxis = axis === "km" ? kmAxis(Math.max(0, ...xs)) : undefined;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-end">
        <SegmentedControl<ScatterYAxis>
          label="Medida"
          value={measure}
          options={[
            { value: "price", label: "Lance em R$" },
            { value: "ratio", label: "% da FIPE" },
          ]}
          onValueChange={setMeasure}
          className="sm:w-64"
        />
        <SegmentedControl<ScatterXAxis>
          label="Eixo horizontal"
          value={axis}
          options={[
            { value: "year", label: "Ano-modelo" },
            { value: "km", label: "Quilometragem" },
          ]}
          onValueChange={setAxis}
          className="sm:w-64"
        />
        <div className="grid gap-2 sm:w-64">
          <span id={highlightLabelId} className="text-label text-foreground">
            Destacar
          </span>
          <Select value={highlight} onValueChange={setHighlight}>
            <SelectTrigger aria-labelledby={highlightLabelId}>
              <SelectValue>{chosen ? `${chosen.label} (${chosen.sales})` : "Nenhum"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_HIGHLIGHT}>Nenhum</SelectItem>
              <SelectGroup>
                <SelectLabel>Estado</SelectLabel>
                {options.states.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} ({option.sales})
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Fonte</SelectLabel>
                {options.sources.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} ({option.sales})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      {points.length > 0 ? (
        <ScatterPlot
          tableAnchorId="pesquisa-vendas-tabela"
          ariaLabel={
            axis === "year" && measure === "price"
              ? yearSummary
              : `${measure === "price" ? "Lance final" : "% da FIPE"} do ${subject} por ${axis === "year" ? "ano-modelo" : "quilometragem"}: ${salesLabel(points.length)}.`
          }
          xValues={xValues}
          xAxis={xAxis}
          yDomain={[0, yEnd]}
          yTicks={yTicks}
          reference={measure === "ratio" ? { value: 1, label: "100% da FIPE" } : undefined}
          points={points}
          medians={axis === "year" ? medians[measure] : []}
        />
      ) : (
        <p className="text-body text-muted">
          Nenhuma venda tem {axis === "year" ? "ano-modelo" : "quilometragem"}
          {measure === "ratio" ? " e % da FIPE" : ""} informado.
        </p>
      )}
      {chosen ? (
        <p className="text-label font-normal text-muted">
          Em destaque: {chosen.label}, {salesLabel(chosen.sales)}.
        </p>
      ) : null}
      {missing > 0 && points.length > 0 ? (
        <p className="text-label font-normal text-muted">
          {salesLabel(missing)} sem {axis === "year" ? "ano-modelo" : "quilometragem"}
          {measure === "ratio" ? " ou % da FIPE" : ""} fora do gráfico.
        </p>
      ) : null}
    </div>
  );
}
