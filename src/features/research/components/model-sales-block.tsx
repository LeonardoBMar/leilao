import { ChartDataTable } from "@/components/charts/chart-data-table";
import { ScatterPlot } from "@/components/charts/scatter-plot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { cents } from "@/domain/money";
import { type ResearchFilters, type ResearchVehicle, vehicleLabel } from "@/domain/research/filters";
import { niceTicks } from "@/lib/charts";
import { formatBRL, formatCompactBRL, formatDate, formatKm, formatRatio } from "@/lib/format";

import { CONDITION_LABELS, salesLabel } from "../labels";
import { getModelSales, MODEL_SALES_LIMIT } from "../queries";
import type { ResearchSale } from "../types";
import { NoSales, ResearchBlock } from "./research-block";

/** Vendas na tabela aberta; as outras ficam em "Ver todas". */
const VISIBLE_SALES = 10;

export function modelSalesTitle(vehicle: ResearchVehicle): string {
  return `Vendas do ${vehicleLabel(vehicle)}`;
}

/**
 * "Vendas do <modelo>" (D-45), só com modelo escolhido: o lance final de cada venda por ano-modelo, com a mediana de
 * cada ano, e a tabela das vendas com link para o anúncio.
 */
export async function ModelSalesBlock({
  filters,
  vehicle,
  since,
}: {
  filters: ResearchFilters;
  vehicle: ResearchVehicle;
  since: Date | null;
}) {
  const data = await getModelSales(filters);
  const title = modelSalesTitle(vehicle);
  if (data === null || data.total === 0) {
    return (
      <ResearchBlock id="pesquisa-vendas" title={title}>
        <NoSales since={since} />
      </ResearchBlock>
    );
  }

  const { total, sales, byYear } = data;
  const dated = sales.flatMap((sale) => (sale.modelYear === null ? [] : [{ ...sale, modelYear: sale.modelYear }]));
  const years = dated.map((sale) => sale.modelYear);
  const [firstYear, lastYear] = [Math.min(...years), Math.max(...years)];
  const xValues = dated.length === 0 ? [] : Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);
  const yTicks = niceTicks(Math.max(...dated.map((sale) => sale.finalBid)));
  const medians = byYear.flatMap(({ year, summary }) =>
    summary.kind === "summary" ? [{ x: year, y: summary.median }] : [],
  );
  const notes = [
    total > sales.length ? `Mostrando as ${MODEL_SALES_LIMIT} mais recentes de ${salesLabel(total)}.` : null,
    dated.length < sales.length ? `${salesLabel(sales.length - dated.length)} sem ano-modelo fora do gráfico.` : null,
  ].filter((note) => note !== null);

  return (
    <ResearchBlock
      id="pesquisa-vendas"
      title={title}
      description={`Lance final de cada venda (${CONDITION_LABELS[filters.condition].toLowerCase()}) por ano-modelo; o traço é a mediana do ano, com 5 vendas ou mais. Passe o mouse num ponto para ver a venda.`}
    >
      {xValues.length > 0 ? (
        <ScatterPlot
          ariaLabel={`Lance final do ${vehicleLabel(vehicle)} por ano-modelo: ${byYear
            .flatMap(({ year, summary }) =>
              summary.kind === "summary" ? [`${year}, mediana ${formatBRL(cents(Math.round(summary.median)))}`] : [],
            )
            .join("; ")}`}
          xValues={xValues}
          yDomain={[0, yTicks.at(-1) ?? 1]}
          yTicks={yTicks}
          formatY={(value) => formatCompactBRL(cents(value))}
          points={dated.map((sale) => ({
            key: sale.id,
            x: sale.modelYear,
            y: sale.finalBid,
            title: saleTitle(sale),
          }))}
          medians={medians}
        />
      ) : null}
      {notes.length > 0 ? <p className="text-label font-normal text-muted">{notes.join(" ")}</p> : null}
      <SalesTable sales={sales.slice(0, VISIBLE_SALES)} />
      {sales.length > VISIBLE_SALES ? (
        <ChartDataTable
          summary={`Ver todas as ${sales.length} vendas`}
          columns={SALE_COLUMNS}
          rows={sales.map(saleRow)}
        />
      ) : null}
    </ResearchBlock>
  );
}

function saleTitle(sale: ResearchSale): string {
  const ratio = sale.ratio === null ? "" : ` (${formatRatio(sale.ratio)} do mercado)`;
  return `${formatDate(sale.endsAt)} · ${sale.state ?? "UF?"} · ${sale.modelYear ?? "ano?"} · ${formatBRL(sale.finalBid)}${ratio}`;
}

const SALE_COLUMNS = [
  { key: "date", label: "Data", align: "left" },
  { key: "sale", label: "Anúncio", align: "left" },
  { key: "year", label: "Ano", align: "right" },
  { key: "km", label: "Km", align: "right" },
  { key: "bid", label: "Lance final", align: "right" },
  { key: "market", label: "Valor de mercado", align: "right" },
  { key: "ratio", label: "% do mercado", align: "right" },
] as const;

function SaleLink({ sale }: { sale: ResearchSale }) {
  return (
    <span className="grid min-w-48 gap-0.5">
      <a
        href={sale.url}
        target="_blank"
        rel="noopener noreferrer"
        className="line-clamp-2 text-accent hover:text-accent-hover hover:underline"
      >
        {sale.title}
      </a>
      <span className="text-caption text-muted">
        {[sale.city && sale.state ? `${sale.city}/${sale.state}` : sale.state, sale.source].filter(Boolean).join(" · ")}
      </span>
    </span>
  );
}

function saleRow(sale: ResearchSale) {
  return {
    key: sale.id,
    date: formatDate(sale.endsAt),
    sale: <SaleLink sale={sale} />,
    year: sale.modelYear === null ? undefined : String(sale.modelYear),
    km: sale.mileageKm === null ? undefined : formatKm(sale.mileageKm),
    bid: formatBRL(sale.finalBid),
    market: sale.marketValue === null ? undefined : formatBRL(sale.marketValue),
    ratio: sale.ratio === null ? undefined : formatRatio(sale.ratio),
  };
}

function SalesTable({ sales }: { sales: readonly ResearchSale[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {SALE_COLUMNS.map((column) => (
            <TableHead key={column.key} className={column.align === "right" ? "text-right" : undefined}>
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.map((sale) => {
          const row = saleRow(sale);
          return (
            <TableRow key={sale.id}>
              {SALE_COLUMNS.map((column) => (
                <TableCell
                  key={column.key}
                  className={column.align === "right" ? "text-right tabular-nums" : "tabular-nums"}
                >
                  {row[column.key] ?? "—"}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
