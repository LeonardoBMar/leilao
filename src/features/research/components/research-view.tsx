import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";

import { salesLabel } from "../labels";
import { getResearchFacets, getResearchOverview } from "../queries";
import { parseResearchParams, researchParams } from "../schemas";
import type { SearchParams } from "../search";
import { BID_CURVE_BLOCK_TITLE, BidCurveBlock } from "./bid-curve-block";
import { CONDITION_BLOCK_TITLE, ConditionBlock } from "./condition-block";
import { ModelSalesBlock, modelSalesTitle } from "./model-sales-block";
import { RANKING_BLOCK_TITLE, RankingBlock } from "./ranking-block";
import { ResearchBlockSkeleton } from "./research-block";
import { ResearchFilterBar } from "./research-filter-bar";
import { STATE_BLOCK_TITLE, StateBlock } from "./state-block";

const HEADER_TITLE = "Pesquisa";

/** Cabeçalho com o tamanho da base: "Preços de arremate do catálogo: 1.506 vendas desde 28/09/2026". */
export async function ResearchHeader() {
  const { sales, since } = await getResearchOverview();
  return (
    <PageHeader
      title={HEADER_TITLE}
      description={`Preços de arremate do catálogo: ${salesLabel(sales)}${since === null ? "" : ` desde ${formatDate(since)}`}.`}
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

  return (
    <div className="grid gap-6">
      <ResearchFilterBar params={researchParams(filters)} facets={facets} />
      <Suspense fallback={<ResearchBlockSkeleton title={CONDITION_BLOCK_TITLE} />}>
        <ConditionBlock filters={filters} since={since} />
      </Suspense>
      <Suspense fallback={<ResearchBlockSkeleton title={STATE_BLOCK_TITLE} className="h-96" />}>
        <StateBlock filters={filters} since={since} />
      </Suspense>
      {filters.vehicle === null ? (
        <Suspense fallback={<ResearchBlockSkeleton title={RANKING_BLOCK_TITLE} className="h-96" />}>
          <RankingBlock filters={filters} />
        </Suspense>
      ) : (
        <Suspense fallback={<ResearchBlockSkeleton title={modelSalesTitle(filters.vehicle)} className="h-96" />}>
          <ModelSalesBlock filters={filters} vehicle={filters.vehicle} since={since} />
        </Suspense>
      )}
      <Suspense fallback={<ResearchBlockSkeleton title={BID_CURVE_BLOCK_TITLE} />}>
        <BidCurveBlock filters={filters} />
      </Suspense>
    </div>
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
