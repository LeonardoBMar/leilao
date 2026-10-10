import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { CollectorStatusLine, CollectorStatusLineSkeleton } from "@/features/listings/components/collector-status";
import { ListingsView, ListingsViewSkeleton } from "@/features/listings/components/listings-view";
import { CATALOG_LISTINGS_PATH } from "@/features/listings/search";

export const metadata: Metadata = { title: "Leilões · Leilão Tracker" };

export default function CatalogListingsPage({ searchParams }: PageProps<"/leiloes/veiculos">) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Leilões"
        description="Lotes encontrados automaticamente nos sites de leilão."
        actions={
          <Suspense fallback={<CollectorStatusLineSkeleton />}>
            <CollectorStatusLine />
          </Suspense>
        }
      />
      <Suspense fallback={<ListingsViewSkeleton />}>
        <ListingsView searchParams={searchParams} basePath={CATALOG_LISTINGS_PATH} />
      </Suspense>
    </div>
  );
}
