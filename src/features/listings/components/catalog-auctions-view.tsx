import { Gavel } from "lucide-react";
import Link from "next/link";

import { ListPagination } from "@/components/layout/list-pagination";
import { ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { getUserPreferences } from "@/features/preferences/queries";
import { formatDateTime } from "@/lib/format";

import { activeFilters, clearedFilters } from "../filter-labels";
import { getListingFacets, listCatalogAuctions } from "../queries";
import { listingParams } from "../schemas";
import { CATALOG_AUCTIONS_PATH, catalogAuctionPath, readListingSearch, type SearchParams, withQuery } from "../search";
import type { CatalogAuctionItem } from "../types";
import { CatalogTabs } from "./catalog-tabs";
import { ListingFilterBar } from "./filters/listing-filter-bar";

/** "Leilões" por leilão (D-42): um cartão por leilão do catálogo com lote no filtro. Renderizar em <Suspense>. */
export async function CatalogAuctionsView({
  searchParams,
  renderSaveWatch,
}: {
  searchParams: SearchParams;
  renderSaveWatch?: (query: string) => React.ReactNode;
}) {
  const { filters, params } = readListingSearch(await searchParams);
  const [page, facets, { region }] = await Promise.all([
    listCatalogAuctions(filters),
    getListingFacets(filters),
    getUserPreferences(),
  ]);
  const hasFilters = activeFilters(filters, {}).length > 0;
  const saveWatch = renderSaveWatch?.(new URLSearchParams(listingParams(filters)).toString());

  return (
    <div className="grid gap-6">
      <CatalogTabs active="auctions" params={params} />
      <ListingFilterBar
        params={params}
        basePath={CATALOG_AUCTIONS_PATH}
        scope="auctions"
        total={page.total}
        facets={facets}
        regionLabel={region.label}
        currentYear={new Date().getUTCFullYear()}
        saveWatch={saveWatch}
      />
      {page.total === 0 ? (
        <EmptyState
          icon={Gavel}
          title={filters.ended ? "Nenhum leilão encerrado encontrado" : "Nenhum leilão aberto encontrado"}
          description="O coletor busca lotes novos a cada 12 horas. Tire um filtro ou aumente a distância."
          action={
            hasFilters ? (
              <ButtonLink
                href={withQuery(CATALOG_AUCTIONS_PATH, listingParams(clearedFilters(filters)))}
                variant="secondary"
              >
                Limpar filtros
              </ButtonLink>
            ) : null
          }
        />
      ) : (
        <section aria-label="Leilões" className="grid gap-4">
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {page.items.map((item) => (
              <li key={`${item.sourceId}/${item.externalId}`} className="flex">
                <CatalogAuctionCard item={item} params={params} />
              </li>
            ))}
          </ul>
          <ListPagination
            basePath={CATALOG_AUCTIONS_PATH}
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

/** Cartão de leilão (DESIGN.md §15.3.1): o cartão inteiro leva ao leilão, com os filtros atuais. */
export function CatalogAuctionCard({
  item,
  params,
}: {
  item: CatalogAuctionItem;
  params: Record<string, string | undefined>;
}) {
  return (
    <Link
      href={withQuery(catalogAuctionPath(item), params)}
      className="grid w-full content-start gap-2 rounded-lg border border-border bg-surface p-5 transition-colors duration-120 outline-none hover:border-border-strong hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      <span className="text-caption text-muted">
        {item.sourceName} · {item.date ? formatDateTime(item.date) : "Data não informada"}
      </span>
      <span className="text-heading-3 text-foreground">{item.name ?? "Leilão sem nome"}</span>
      <CatalogAuctionNumbers item={item} />
    </Link>
  );
}

/** "214 lotes · 147 abertos · 37 no filtro · 3 analisados"; zeros de abertos e analisados ficam de fora. */
export function CatalogAuctionNumbers({
  item,
  showMatching = true,
}: {
  item: CatalogAuctionItem;
  showMatching?: boolean;
}) {
  const parts = [
    plural(item.total, "lote", "lotes"),
    item.open > 0 ? plural(item.open, "aberto", "abertos") : null,
    showMatching ? `${item.matching} no filtro` : null,
  ].filter((part) => part !== null);

  return (
    <span className="flex flex-wrap items-baseline gap-x-2 text-caption text-foreground-secondary tabular-nums">
      <span>{parts.join(" · ")}</span>
      {item.analyzed > 0 ? (
        <span className="font-semibold text-foreground">· {plural(item.analyzed, "analisado", "analisados")}</span>
      ) : null}
    </span>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function CatalogAuctionsViewSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-10" />
      <Skeleton className="h-28" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
