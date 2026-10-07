import { Radar } from "lucide-react";

import { ListPagination } from "@/components/layout/list-pagination";
import { Alert, AlertDescription, EmptyState, Skeleton } from "@/components/ui";

import { listListings } from "../queries";
import type { ListingFilters as Filters } from "../schemas";
import { readListingSearch, type SearchParams } from "../search";
import type { CatalogAuctionKey } from "../types";
import { CatalogTabs } from "./catalog-tabs";
import { ListingCard } from "./listing-card";
import { ListingFilters } from "./listing-filters";

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
  const { filters, values, params } = readListingSearch(await searchParams);

  return (
    <div className="grid gap-6">
      {auction ? null : <CatalogTabs active="listings" params={params} />}
      <ListingFilters values={values} basePath={basePath} />
      <ListingList filters={filters} params={params} basePath={basePath} auction={auction} />
    </div>
  );
}

async function ListingList({
  filters,
  params,
  basePath,
  auction,
}: {
  filters: Filters;
  params: Record<string, string | undefined>;
  basePath: string;
  auction?: CatalogAuctionKey;
}) {
  const page = await listListings(filters, { auction });

  if (page.total === 0) {
    return (
      <EmptyState
        icon={Radar}
        title={filters.ended ? "Nenhum lote encerrado encontrado" : "Nenhum lote aberto encontrado"}
        description={
          auction
            ? "Nenhum lote deste leilão atende aos filtros. Ajuste a distância, a situação ou limpe os filtros."
            : "O coletor busca lotes novos a cada 2 horas. Ajuste a distância ou limpe os filtros."
        }
      />
    );
  }

  return (
    <section aria-label="Lotes coletados" className="grid gap-4">
      {page.truncated ? (
        <Alert variant="info">
          <AlertDescription>
            Muitos lotes para esta busca: mostrando só os primeiros. Refine a busca, o ano ou o preço para ver todos.
          </AlertDescription>
        </Alert>
      ) : null}
      <ul className="grid gap-x-7 gap-y-11 sm:grid-cols-2 xl:grid-cols-3">
        {page.items.map((item, index) => (
          <li key={item.id}>
            <ListingCard item={item} eager={index < FIRST_ROW} />
          </li>
        ))}
      </ul>
      <ListPagination
        basePath={basePath}
        params={params}
        page={page.page}
        pageSize={page.pageSize}
        total={page.total}
      />
    </section>
  );
}

export function ListingsViewSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-40" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
