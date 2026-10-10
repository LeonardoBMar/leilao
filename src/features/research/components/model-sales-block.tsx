import type { ReactNode } from "react";

import { ChartDataTable } from "@/components/charts/chart-data-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import type { MarketValueOrigin } from "@/domain/listings/fipe-match";
import { cents } from "@/domain/money";
import { type ResearchFilters, type ResearchVehicle, vehicleLabel } from "@/domain/research/filters";
import { formatBRL, formatDate, formatKm, formatRatio } from "@/lib/format";

import { CONDITION_LABELS, salesLabel } from "../labels";
import { getModelSales, MODEL_SALES_LIMIT } from "../queries";
import type { ResearchSale } from "../types";
import { ModelSalesScatter } from "./model-sales-scatter";
import { ResearchBlock } from "./research-block";

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
  noSales,
}: {
  filters: ResearchFilters;
  vehicle: ResearchVehicle;
  noSales: ReactNode;
}) {
  const data = await getModelSales(filters);
  const title = modelSalesTitle(vehicle);
  if (data === null || data.total === 0) {
    return (
      <ResearchBlock id="pesquisa-vendas" title={title}>
        {noSales}
      </ResearchBlock>
    );
  }

  const { total, sales, byYear } = data;
  const medians = byYear.flatMap(({ year, summary }) =>
    summary.kind === "summary" ? [{ x: year, y: summary.median }] : [],
  );
  const scatterSales = sales.map((sale) => ({
    id: sale.id,
    url: sale.url,
    label: saleTitle(sale),
    year: sale.modelYear,
    km: sale.mileageKm,
    state: sale.state,
    source: sale.source,
    finalBid: sale.finalBid,
  }));
  const yearSummary = `Lance final do ${vehicleLabel(vehicle)} por ano-modelo: ${byYear
    .flatMap(({ year, summary }) =>
      summary.kind === "summary" ? [`${year}, mediana ${formatBRL(cents(Math.round(summary.median)))}`] : [],
    )
    .join("; ")}`;
  const note = total > sales.length ? `Mostrando as ${MODEL_SALES_LIMIT} mais recentes de ${salesLabel(total)}.` : null;

  return (
    <ResearchBlock
      id="pesquisa-vendas"
      title={title}
      description={`Lance final de cada venda (${CONDITION_LABELS[filters.condition].toLowerCase()}) por ano-modelo ou quilometragem; o traço é a mediana do ano, com 5 vendas ou mais. Destaque um estado ou uma fonte para ver onde ele cai. Passe o mouse ou toque num ponto para ver a venda; todas estão na tabela.`}
    >
      <ModelSalesScatter
        sales={scatterSales}
        medians={medians}
        subject={vehicleLabel(vehicle)}
        yearSummary={yearSummary}
      />
      {note ? <p className="text-label font-normal text-muted">{note}</p> : null}
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
  const km = sale.mileageKm === null ? "" : ` · ${formatKm(sale.mileageKm)}`;
  return `${formatDate(sale.endsAt)} · ${sale.state ?? "UF?"} · ${sale.modelYear ?? "ano?"}${km} · ${formatBRL(sale.finalBid)}${ratio}`;
}

/** O lance e o % logo depois do anúncio: no celular, a tabela rola para o lado e eles ficam à vista. */
/** Valor de mercado casado pelo sistema (D-47) é marcado na tabela; o da fonte fica sem marca. */
const MARKET_ORIGIN_MARKS = {
  source: "",
  fipe_version: " · FIPE",
  fipe_family: " · FIPE aprox.",
} satisfies Record<MarketValueOrigin, string>;

const SALE_COLUMNS = [
  { key: "date", label: "Data", align: "left" },
  { key: "sale", label: "Anúncio", align: "left" },
  { key: "bid", label: "Lance final", align: "right" },
  { key: "ratio", label: "% do mercado", align: "right" },
  { key: "year", label: "Ano", align: "right" },
  { key: "km", label: "Km", align: "right" },
  { key: "market", label: "Valor de mercado", align: "right" },
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
    market:
      sale.marketValue === null
        ? undefined
        : `${formatBRL(sale.marketValue)}${MARKET_ORIGIN_MARKS[sale.marketValueOrigin ?? "source"]}`,
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
                  className={column.align === "right" ? "text-right whitespace-nowrap tabular-nums" : "tabular-nums"}
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
