"use client";

import { useState } from "react";

import { type ContinuousAxis, ScatterPlot } from "@/components/charts/scatter-plot";
import { SegmentedControl } from "@/components/ui";
import { cents } from "@/domain/money";
import { niceTicks } from "@/lib/charts";
import { formatCompactBRL, formatShortMonth } from "@/lib/format";

import { salesLabel } from "../labels";

/** Venda do recorte para o gráfico: tudo serializável, para atravessar a fronteira servidor→cliente. */
export type EvaluateChartSale = {
  id: string;
  url: string;
  label: string;
  year: number | null;
  /** Fim do leilão em ms. */
  endsAt: number;
  /** Lance final em centavos. */
  bid: number;
  excluded: boolean;
};

/** Lote aberto do recorte: o lance atual, que ainda sobe. */
export type EvaluateChartOpen = {
  id: string;
  url: string;
  label: string;
  year: number | null;
  endsAt: number | null;
  /** Lance atual em centavos. */
  bid: number;
};

type XAxis = "year" | "date";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Eixo de datas com uma marca no começo de cada mês. */
function dateAxis(times: readonly number[]): ContinuousAxis {
  const first = Math.min(...times);
  const last = Math.max(...times);
  const ticks: { value: number; label: string }[] = [];
  const cursor = new Date(first);
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  while (cursor.getTime() <= last) {
    ticks.push({ value: cursor.getTime(), label: formatShortMonth(cursor) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return { domain: [first - 2 * DAY_MS, last + 2 * DAY_MS], ticks };
}

/**
 * Vendas e lotes abertos do recorte (docs/PLANO-MERCADO.md §5.2): vendidos em ponto cheio (excluídos mais claros),
 * abertos em ponto vazado com um traço até a mediana, e a faixa típica sombreada. No eixo da data, a tendência aparece
 * sem bloco próprio. A lista de comparáveis e a tabela de lotes abertos dizem o mesmo em texto.
 */
export function EvaluateChart({
  sales,
  open,
  band,
  subject,
}: {
  sales: readonly EvaluateChartSale[];
  open: readonly EvaluateChartOpen[];
  band: { low: number; median: number; high: number } | null;
  subject: string;
}) {
  const [axis, setAxis] = useState<XAxis>("year");
  const xOf = (item: { year: number | null; endsAt: number | null }) => (axis === "year" ? item.year : item.endsAt);
  const points = [
    ...sales.flatMap((sale) => {
      const x = xOf(sale);
      return x === null
        ? []
        : [
            {
              key: sale.id,
              x,
              y: sale.bid,
              title: `${sale.label}${sale.excluded ? " · fora da conta" : ""}`,
              href: sale.url,
              muted: sale.excluded,
            },
          ];
    }),
    ...open.flatMap((listing) => {
      const x = xOf(listing);
      return x === null
        ? []
        : [
            {
              key: `aberto-${listing.id}`,
              x,
              y: listing.bid,
              title: `${listing.label} · aberto`,
              href: listing.url,
              hollow: true,
              guideTo: band?.median,
            },
          ];
    }),
  ];
  const yMax = Math.max(0, band?.high ?? 0, ...points.map(({ y }) => y));
  const yTicks = niceTicks(yMax).map((value) => ({ value, label: formatCompactBRL(cents(value)) }));
  const xs = points.map(({ x }) => x);
  const xValues =
    axis === "year" && xs.length > 0
      ? Array.from({ length: Math.max(...xs) - Math.min(...xs) + 1 }, (_, i) => Math.min(...xs) + i)
      : [];
  const missing = sales.length + open.length - points.length;

  return (
    <div className="grid gap-4">
      <SegmentedControl<XAxis>
        label="Eixo horizontal"
        value={axis}
        options={[
          { value: "year", label: "Ano-modelo" },
          { value: "date", label: "Data" },
        ]}
        onValueChange={setAxis}
        className="sm:w-64"
      />
      {points.length === 0 ? (
        <p className="text-body text-muted">Nenhuma venda tem {axis === "year" ? "ano-modelo" : "data"} informado.</p>
      ) : (
        <ScatterPlot
          ariaLabel={`Lances finais do ${subject} por ${axis === "year" ? "ano-modelo" : "data"}: ${salesLabel(sales.length)}${
            open.length > 0 ? ` e ${open.length} ${open.length === 1 ? "lote aberto" : "lotes abertos"}` : ""
          }${band ? `; faixa típica de ${formatCompactBRL(cents(band.low))} a ${formatCompactBRL(cents(band.high))}` : ""}.`}
          xValues={xValues}
          xAxis={axis === "date" ? dateAxis(xs) : undefined}
          yDomain={[0, yTicks.at(-1)?.value ?? 1]}
          yTicks={yTicks}
          band={band === null ? undefined : { low: band.low, high: band.high, label: "faixa típica" }}
          points={points}
        />
      )}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-data-3" /> vendido
        </li>
        {open.length > 0 ? (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-surface ring-2 ring-foreground" /> aberto:
            lance atual, com traço até a mediana
          </li>
        ) : null}
        {band ? (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-4 rounded-sm bg-data-1" /> faixa típica
          </li>
        ) : null}
        {missing > 0 ? (
          <li>
            {missing} sem {axis === "year" ? "ano-modelo" : "data"} fora do gráfico
          </li>
        ) : null}
      </ul>
    </div>
  );
}
