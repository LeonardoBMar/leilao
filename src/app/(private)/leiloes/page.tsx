import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { CatalogAuctionsView, CatalogAuctionsViewSkeleton } from "@/features/listings/components/catalog-auctions-view";
import { CollectorStatusLine, CollectorStatusLineSkeleton } from "@/features/listings/components/collector-status";

export const metadata: Metadata = { title: "Leilões · Leilão Tracker" };

export default function CatalogAuctionsPage({ searchParams }: PageProps<"/leiloes">) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Leilões"
        description="Leilões encontrados automaticamente nos sites, com todos os lotes coletados."
        actions={
          <Suspense fallback={<CollectorStatusLineSkeleton />}>
            <CollectorStatusLine />
          </Suspense>
        }
      />
      <Suspense fallback={<CatalogAuctionsViewSkeleton />}>
        <CatalogAuctionsView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
