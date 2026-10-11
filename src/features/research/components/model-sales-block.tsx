import type { Route } from "next";
import type { ReactNode } from "react";

import { cents } from "@/domain/money";
import { type ResearchFilters, type ResearchVehicle, vehicleLabel } from "@/domain/research/filters";
import { MIN_SALE_BID_STEPS } from "@/domain/research/sale-bids";
import { formatBRL, formatDate, formatKm, formatRatio } from "@/lib/format";

import { CONDITION_LABELS, salesLabel } from "../labels";
import { getModelSales, MODEL_SALES_LIMIT } from "../queries";
import { researchHref } from "../search";
import type { ResearchSale } from "../types";
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
  actions,
}: {
  filters: ResearchFilters;
  vehicle: ResearchVehicle;
  noSales: ReactNode;
  /** Ações do modelo (lotes abertos, monitor), compostas pela rota. */
  actions: ReactNode;
}) {
  const data = await getModelSales(filters);
  const title = modelSalesTitle(vehicle);
  if (data === null || data.total === 0) {
    return (
      <ResearchBlock id="pesquisa-vendas" title={title} actions={actions}>
        {noSales}
      </ResearchBlock>
    );
  }

  const { total, sales, byYear } = data;
  // Lances só quando o coletor viu a subida; o painel abre no bloco do lance, logo abaixo, e rola até si.
  const bidsHrefOf = (sale: ResearchSale): Route | null =>
    sale.bidSteps >= MIN_SALE_BID_STEPS ? researchHref({ ...filters, sale: sale.id }) : null;
  const medians = {
    price: byYear.flatMap(({ year, summary }) => (summary.kind === "summary" ? [{ x: year, y: summary.median }] : [])),
    ratio: byYear.flatMap(({ year, ratio }) => (ratio.kind === "summary" ? [{ x: year, y: ratio.median }] : [])),
  };
  const scatterSales = sales.map((sale) => ({
    id: sale.id,
    url: sale.url,
    label: saleTitle(sale),
    year: sale.modelYear,
    km: sale.mileageKm,
    state: sale.state,
    source: sale.source,
    finalBid: sale.finalBid,
    ratio: sale.ratioInBounds ? sale.ratio : null,
    bidsHref: bidsHrefOf(sale),
  }));
  const yearSummary = `Lance final do ${vehicleLabel(vehicle)} por ano-modelo: ${byYear
    .flatMap(({ year, summary }) =>
      summary.kind === "summary" ? [`${year}, mediana ${formatBRL(cents(Math.round(summary.median)))}`] : [],
    )
    .join("; ")}`;
  const note =
    total > sales.length
      ? `Mostrando as ${MODEL_SALES_LIMIT} mais recentes de ${salesLabel(total)}; a ordem e o filtro da tabela valem dentro delas.`
      : null;
  // Outro recorte recomeça a ordem, o filtro de estado e o destaque (senão a tabela poderia ficar vazia); abrir os
  // lances de uma venda não é outro recorte.
  const recortKey = researchHref({ ...filters, sale: null });

  return (
    <ResearchBlock
      id="pesquisa-vendas"
      title={title}
      actions={actions}
      description={`Cada ponto é uma venda (${CONDITION_LABELS[filters.condition].toLowerCase()}); o traço é a mediana do ano, com 5 vendas ou mais.`}
    >
      <ModelSalesScatter
        key={`dispersao:${recortKey}`}
        sales={scatterSales}
        medians={medians}
        subject={vehicleLabel(vehicle)}
        yearSummary={yearSummary}
        selectedSale={filters.sale}
      />
      {note ? <p className="text-label font-normal text-muted">{note}</p> : null}
      <ModelSalesTable
        key={`tabela:${recortKey}`}
        sales={sales.map((sale) => ({ ...sale, bidsHref: bidsHrefOf(sale) }))}
        selectedSale={filters.sale}
      />
    </ResearchBlock>
  );
}

function saleTitle(sale: ResearchSale): string {
  const ratio = sale.ratio === null ? "" : ` (${formatRatio(sale.ratio)} do mercado)`;
  const km = sale.mileageKm === null ? "" : ` · ${formatKm(sale.mileageKm)}`;
  return `${formatDate(sale.endsAt)} · ${sale.state ?? "UF?"} · ${sale.modelYear ?? "ano?"}${km} · ${formatBRL(sale.finalBid)}${ratio}`;
}
