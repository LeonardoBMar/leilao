import { type ReactNode, Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui";
import { RESEARCH_CATEGORIES, type ResearchFilters } from "@/domain/research/filters";
import { formatDate } from "@/lib/format";

import { salesLabel } from "../labels";
import { noSalesSuggestions } from "../no-sales";
import { getResearchFacets, getResearchOverview } from "../queries";
import { parseResearchParams, researchParams } from "../schemas";
import type { SearchParams } from "../search";
import { COMPARISON_BLOCK_TITLE, ComparisonBlock } from "./comparison-block";
import { CONDITION_BLOCK_TITLE, ConditionBlock } from "./condition-block";
import { ModelSalesBlock, modelSalesTitle } from "./model-sales-block";
import { ORIGIN_BLOCK_TITLE, OriginBlock } from "./origin-block";
import { RANKING_BLOCK_TITLE, RankingBlock } from "./ranking-block";
import { READING_BLOCK_TITLE, ReadingBlock } from "./reading-block";
import { NoSales, ResearchBlockSkeleton } from "./research-block";
import { ResearchFilterBar } from "./research-filter-bar";
import { ResearchShell } from "./research-shell";
import { ResearchSummary, ResearchSummarySkeleton } from "./research-summary";
import { STATE_BLOCK_TITLE, StateBlock } from "./state-block";
import { TrendBlock } from "./trend-block";

const HEADER_TITLE = "Mercado";

/**
 * Cabeçalho com o tamanho da base: "1.506 vendas arrematadas no catálogo desde 28/09/2026". De onde vem a FIPE fica em
 * "Como lemos os dados".
 */
export async function ResearchHeader() {
  const { sales, since } = await getResearchOverview();
  return (
    <PageHeader
      title={HEADER_TITLE}
      description={`${salesLabel(sales)} arrematadas no catálogo${since === null ? "" : ` desde ${formatDate(since)}`}.`}
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
  const rawParams = await searchParams;
  let filters = parseResearchParams(rawParams);
  const [initialFacets, { since }] = await Promise.all([getResearchFacets(filters), getResearchOverview()]);
  let facets = initialFacets;

  // Ao chegar do Avaliar com moto ou utilitário sem `categoria` explícita na URL, escolhe a categoria com mais vendas
  // do modelo em vez de cair em 0 vendas sob o padrão `carros`.
  if (rawParams.categoria === undefined && filters.vehicle !== null && facets.categories[filters.category] === 0) {
    const dominant = RESEARCH_CATEGORIES.toSorted((a, b) => facets.categories[b] - facets.categories[a])[0];
    if (dominant && facets.categories[dominant] > 0) {
      filters = { ...filters, category: dominant };
      facets = await getResearchFacets(filters);
    }
  }

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
      {/* De quem se compra e em que condição: duas distribuições do % da FIPE, lado a lado na tela larga. */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Suspense fallback={<ResearchBlockSkeleton title={ORIGIN_BLOCK_TITLE} />}>
          <OriginBlock filters={filters} />
        </Suspense>
        <Suspense fallback={<ResearchBlockSkeleton title={CONDITION_BLOCK_TITLE} />}>
          <ConditionBlock filters={filters} noSales={noSales} />
        </Suspense>
      </div>
      {/* A tendência só aparece com base (D-75): sem esqueleto, para não reservar lugar que pode sumir. */}
      <Suspense fallback={null}>
        <TrendBlock filters={filters} />
      </Suspense>
      <Suspense fallback={<ResearchBlockSkeleton title={STATE_BLOCK_TITLE} className="h-96" />}>
        <StateBlock filters={filters} noSales={noSales} />
      </Suspense>
      <Suspense fallback={<ResearchBlockSkeleton title={READING_BLOCK_TITLE} className="h-10" />}>
        <ReadingBlock filters={filters} />
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
