import { type ReactNode, Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui";
import type { ResearchFilters } from "@/domain/research/filters";
import { formatDate, formatRatio } from "@/lib/format";

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

/** Cabeçalho com o tamanho da base: "1.506 vendas arrematadas no catálogo desde 28/09/2026 · 62% com FIPE casado…". */
export async function ResearchHeader() {
  const { sales, fipeMatched, since } = await getResearchOverview();
  // Valor de mercado casado pelo sistema entra no % do mercado (D-47); o cabeçalho diz quanto da base é assim.
  const matched =
    fipeMatched === 0 || sales === 0 ? "" : ` · ${formatRatio(fipeMatched / sales)} com valor FIPE casado pelo sistema`;
  return (
    <PageHeader
      title={HEADER_TITLE}
      description={`${salesLabel(sales)} arrematadas no catálogo${since === null ? "" : ` desde ${formatDate(since)}`}${matched}.`}
    />
  );
}

export function ResearchHeaderSkeleton() {
  return <PageHeader title={HEADER_TITLE} description="Arremates do catálogo." />;
}

/**
 * Pesquisa (D-45): filtros da URL, barra de filtros e os blocos, cada um no seu `<Suspense>` para aparecer assim que a
 * consulta dele termina.
 */
export async function ResearchView({
  searchParams,
  modelActions,
}: {
  searchParams: SearchParams;
  /** Ações do modelo escolhido (lotes abertos, monitor), compostas pela rota: elas juntam outras features. */
  modelActions: (filters: ResearchFilters) => ReactNode;
}) {
  const filters = parseResearchParams(await searchParams);
  const [facets, { since }] = await Promise.all([getResearchFacets(filters), getResearchOverview()]);

  const noSales = <NoSales since={since} suggestions={noSalesSuggestions(filters, facets)} />;

  return (
    <ResearchShell filterBar={<ResearchFilterBar params={researchParams(filters)} facets={facets} />}>
      <Suspense fallback={<ResearchSummarySkeleton />}>
        <ResearchSummary filters={filters} />
      </Suspense>
      {filters.compare === null ? null : (
        <Suspense fallback={<ResearchBlockSkeleton title={COMPARISON_BLOCK_TITLE} />}>
          <ComparisonBlock filters={filters} noSales={noSales} />
        </Suspense>
      )}
      {filters.vehicle === null ? (
        <Suspense fallback={<ResearchBlockSkeleton title={RANKING_BLOCK_TITLE} className="h-96" />}>
          <RankingBlock filters={filters} />
        </Suspense>
      ) : (
        <Suspense fallback={<ResearchBlockSkeleton title={modelSalesTitle(filters.vehicle)} className="h-96" />}>
          <ModelSalesBlock
            filters={filters}
            vehicle={filters.vehicle}
            noSales={noSales}
            actions={modelActions(filters)}
          />
        </Suspense>
      )}
      {/* Os dois blocos de leitura geral lado a lado na tela larga: a condição pede mais largura que a curva. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Suspense fallback={<ResearchBlockSkeleton title={CONDITION_BLOCK_TITLE} />}>
          <ConditionBlock filters={filters} noSales={noSales} />
        </Suspense>
        <Suspense fallback={<ResearchBlockSkeleton title={BID_CURVE_BLOCK_TITLE} />}>
          <BidCurveBlock filters={filters} />
        </Suspense>
      </div>
      <Suspense fallback={<ResearchBlockSkeleton title={STATE_BLOCK_TITLE} className="h-96" />}>
        <StateBlock filters={filters} noSales={noSales} />
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
      <ResearchSummarySkeleton />
      <ResearchBlockSkeleton title={RANKING_BLOCK_TITLE} className="h-96" />
    </div>
  );
}
