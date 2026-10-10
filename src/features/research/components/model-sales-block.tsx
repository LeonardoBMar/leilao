import type { ReactNode } from "react";

import { cents } from "@/domain/money";
import { type ResearchFilters, type ResearchVehicle, vehicleLabel } from "@/domain/research/filters";
import { formatBRL, formatDate, formatKm, formatRatio } from "@/lib/format";

import { CONDITION_LABELS, salesLabel } from "../labels";
import { getModelSales, MODEL_SALES_LIMIT } from "../queries";
import type { ResearchSale } from "../types";
import { ModelCatalogActions } from "./model-catalog-actions";
import { ModelSalesScatter } from "./model-sales-scatter";
import { ModelSalesTable } from "./model-sales-table";
import { ResearchBlock } from "./research-block";

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
      <ResearchBlock id="pesquisa-vendas" title={title} actions={<ModelCatalogActions filters={filters} />}>
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
      actions={<ModelCatalogActions filters={filters} />}
      description={`Lance final de cada venda (${CONDITION_LABELS[filters.condition].toLowerCase()}) por ano-modelo ou quilometragem; o traço é a mediana do ano, com 5 vendas ou mais. Destaque um estado ou uma fonte para ver onde ele cai. Passe o mouse ou toque num ponto para ver a venda; todas estão na tabela.`}
    >
      <ModelSalesScatter
        sales={scatterSales}
        medians={medians}
        subject={vehicleLabel(vehicle)}
        yearSummary={yearSummary}
      />
      {note ? <p className="text-label font-normal text-muted">{note}</p> : null}
      <ModelSalesTable sales={sales} />
    </ResearchBlock>
  );
}

function saleTitle(sale: ResearchSale): string {
  const ratio = sale.ratio === null ? "" : ` (${formatRatio(sale.ratio)} do mercado)`;
  const km = sale.mileageKm === null ? "" : ` · ${formatKm(sale.mileageKm)}`;
  return `${formatDate(sale.endsAt)} · ${sale.state ?? "UF?"} · ${sale.modelYear ?? "ano?"}${km} · ${formatBRL(sale.finalBid)}${ratio}`;
}
