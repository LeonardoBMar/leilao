import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";

import { salesLabel } from "../labels";
import { noSalesSuggestions } from "../no-sales";
import { getResearchFacets, getResearchOverview } from "../queries";
import { parseResearchParams, researchParams } from "../schemas";
import type { SearchParams } from "../search";
import { BID_CURVE_BLOCK_TITLE, BidCurveBlock } from "./bid-curve-block";
import { COMPARISON_BLOCK_TITLE, ComparisonBlock } from "./comparison-block";
import { CONDITION_BLOCK_TITLE, ConditionBlock } from "./condition-block";
import { ModelSalesBlock, modelSalesTitle } from "./model-sales-block";
import { RANKING_BLOCK_TITLE, RankingBlock } from "./ranking-block";
import { NoSales, ResearchBlockSkeleton } from "./research-block";
import { ResearchFilterBar } from "./research-filter-bar";
import { ResearchShell } from "./research-shell";
import { ResearchSummary, ResearchSummarySkeleton } from "./research-summary";
import { STATE_BLOCK_TITLE, StateBlock } from "./state-block";

const HEADER_TITLE = "Pesquisa";

/** Cabeçalho com o tamanho da base: "Preços de arremate do catálogo: 1.506 vendas desde 28/09/2026". */
export async function ResearchHeader() {
  const { sales, fipeMatched, since } = await getResearchOverview();
  // Valor de mercado casado pelo sistema entra no % do mercado (D-47); o cabeçalho diz quanto da base é assim.
  const matched =
    fipeMatched === 0
      ? ""
      : ` ${fipeMatched.toLocaleString("pt-BR")} com valor de mercado da FIPE casado pelo sistema.`;
  return (
    <PageHeader
      title={HEADER_TITLE}
      description={`Preços de arremate do catálogo: ${salesLabel(sales)}${since === null ? "" : ` desde ${formatDate(since)}`}.${matched}`}
    />
  );
}

export function ResearchHeaderSkeleton() {
  return <PageHeader title={HEADER_TITLE} description="Preços de arremate do catálogo." />;
}

/**
 * Pesquisa (D-45): filtros da URL, barra de filtros e os blocos, cada um no seu `<Suspense>` para aparecer assim que a
 * consulta dele termina.
 */
export async function ResearchView({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseResearchParams(await searchParams);
  const [facets, { since }] = await Promise.all([getResearchFacets(filters), getResearchOverview()]);

  const noSales = <NoSales since={since} suggestions={noSalesSuggestions(filters, facets)} />;

  return (
    <ResearchShell filterBar={<ResearchFilterBar params={researchParams(filters)} facets={facets} />}>
      <Suspense fallback={<ResearchSummarySkeleton />}>
        <ResearchSummary filters={filters} />
      </Suspense>
      <Suspense fallback={<ResearchBlockSkeleton title={CONDITION_BLOCK_TITLE} />}>
        <ConditionBlock filters={filters} total={facets.conditions[filters.condition]} noSales={noSales} />
      </Suspense>
      {filters.compare === null ? null : (
        <Suspense fallback={<ResearchBlockSkeleton title={COMPARISON_BLOCK_TITLE} />}>
          <ComparisonBlock filters={filters} noSales={noSales} />
        </Suspense>
      )}
      <Suspense fallback={<ResearchBlockSkeleton title={STATE_BLOCK_TITLE} className="h-96" />}>
        <StateBlock filters={filters} noSales={noSales} />
      </Suspense>
      {filters.vehicle === null ? (
        <Suspense fallback={<ResearchBlockSkeleton title={RANKING_BLOCK_TITLE} className="h-96" />}>
          <RankingBlock filters={filters} />
        </Suspense>
      ) : (
        <Suspense fallback={<ResearchBlockSkeleton title={modelSalesTitle(filters.vehicle)} className="h-96" />}>
          <ModelSalesBlock filters={filters} vehicle={filters.vehicle} noSales={noSales} />
        </Suspense>
      )}
      <Suspense fallback={<ResearchBlockSkeleton title={BID_CURVE_BLOCK_TITLE} />}>
        <BidCurveBlock filters={filters} />
      </Suspense>
    </ResearchShell>
  );
}

export function ResearchViewSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 border-b border-border pb-5 md:flex">
        <Skeleton className="h-10 md:flex-1" />
        <Skeleton className="h-10 md:w-60" />
        <Skeleton className="h-10 md:w-44" />
      </div>
      <ResearchBlockSkeleton title={CONDITION_BLOCK_TITLE} />
      <ResearchBlockSkeleton title={STATE_BLOCK_TITLE} className="h-96" />
    </div>
  );
}
