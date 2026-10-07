import type { Metadata } from "next";
import { Suspense } from "react";

import { CatalogAuctionView, CatalogAuctionViewSkeleton } from "@/features/listings/components/catalog-auction-view";
import { ListingsView, ListingsViewSkeleton } from "@/features/listings/components/listings-view";
import { catalogAuctionParamsSchema } from "@/features/listings/schemas";
import { catalogAuctionPath } from "@/features/listings/search";

export const metadata: Metadata = { title: "Leilão · Leilão Tracker" };

export default function CatalogAuctionPage({ params, searchParams }: PageProps<"/leiloes/[source]/[auction]">) {
  return (
    <Suspense fallback={<CatalogAuctionViewSkeleton />}>
      <CatalogAuctionView
        params={params}
        listings={
          <Suspense fallback={<ListingsViewSkeleton />}>
            <AuctionListings params={params} searchParams={searchParams} />
          </Suspense>
        }
      />
    </Suspense>
  );
}

/** Anúncios do leilão. Parâmetros inválidos não renderizam nada: o cabeçalho já responde com 404. */
async function AuctionListings({ params, searchParams }: PageProps<"/leiloes/[source]/[auction]">) {
  const parsed = catalogAuctionParamsSchema.safeParse(await params);
  if (!parsed.success) return null;
  return <ListingsView searchParams={searchParams} basePath={catalogAuctionPath(parsed.data)} auction={parsed.data} />;
}
