import { Radar } from "lucide-react";

import { ListPagination } from "@/components/layout/list-pagination";
import { Alert, AlertDescription, ButtonLink, EmptyState, MotionList, MotionListItem, Skeleton } from "@/components/ui";
import { DEFAULT_REGION } from "@/domain/listings/region";

import { activeFilters, clearedFilters } from "../filter-labels";
import { getListingFacets, listListings } from "../queries";
import { listingParams } from "../schemas";
import { readListingSearch, type SearchParams, withQuery } from "../search";
import type { CatalogAuctionKey } from "../types";
import { CatalogTabs } from "./catalog-tabs";
import { ListingFilterBar } from "./filters/listing-filter-bar";
import { ListingCard } from "./listing-card";

/** Cards na primeira linha no layout mais largo (3 colunas). */
const FIRST_ROW = 3;

type ListingsViewProps = {
  searchParams: SearchParams;
  /** Tela que recebe filtros e paginação. */
  basePath: string;
  /** Só os anúncios deste leilão do catálogo (página do leilão); sem ele, "Todos os veículos", com as abas. */
  auction?: CatalogAuctionKey;
};

/** Anúncios coletados, com filtros na URL. Renderizar dentro de <Suspense>. */
export async function ListingsView({ searchParams, basePath, auction }: ListingsViewProps) {
  const { filters, params } = readListingSearch(await searchParams);
  const [page, facets] = await Promise.all([
    listListings(filters, { auction }),
    getListingFacets(filters, { auction }),
  ]);
  const hasFilters = activeFilters(filters, {}).length > 0;

  return (
    <div className="grid gap-6">
      {auction ? null : <CatalogTabs active="listings" params={params} />}
      <ListingFilterBar
        params={params}
        basePath={basePath}
        scope={auction ? "auction" : "listings"}
        total={page.total}
        facets={facets}
        regionLabel={DEFAULT_REGION.label}
        currentYear={new Date().getUTCFullYear()}
      />
      {page.total === 0 ? (
        <EmptyState
          icon={Radar}
          title={filters.ended ? "Nenhum lote encerrado encontrado" : "Nenhum lote aberto encontrado"}
          description={
            auction
              ? "Nenhum lote deste leilão atende aos filtros. Tire um filtro ou aumente a distância."
              : "O coletor busca lotes novos a cada 12 horas. Tire um filtro ou aumente a distância."
          }
          action={
            hasFilters ? (
              <ButtonLink href={withQuery(basePath, listingParams(clearedFilters(filters)))} variant="secondary">
                Limpar filtros
              </ButtonLink>
            ) : null
          }
        />
      ) : (
        <section aria-label="Lotes coletados" className="grid gap-4">
          {page.truncated ? (
            <Alert variant="info">
              <AlertDescription>
                Muitos lotes para esta busca: mostrando só os primeiros. Refine a busca, o ano ou o preço para ver
                todos.
              </AlertDescription>
            </Alert>
          ) : null}
          <MotionList className="grid gap-x-7 gap-y-11 sm:grid-cols-2 xl:grid-cols-3">
            {page.items.map((item, index) => (
              <MotionListItem key={item.id}>
                <ListingCard item={item} eager={index < FIRST_ROW} />
              </MotionListItem>
            ))}
          </MotionList>
          <ListPagination
            basePath={basePath}
            params={params}
            page={page.page}
            pageSize={page.pageSize}
            total={page.total}
          />
        </section>
      )}
    </div>
  );
}

export function ListingsViewSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-10" />
      <Skeleton className="h-28" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
