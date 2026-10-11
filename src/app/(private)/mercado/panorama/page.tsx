import type { Metadata } from "next";
import { Suspense } from "react";

import { MarketTabs } from "@/features/research/components/market-tabs";
import {
  ResearchHeader,
  ResearchHeaderSkeleton,
  ResearchView,
  ResearchViewSkeleton,
} from "@/features/research/components/research-view";

import { ModelCatalogActions } from "./model-catalog-actions";

export const metadata: Metadata = { title: "Panorama · Mercado · Leilão Tracker" };

export default function PanoramaPage({ searchParams }: PageProps<"/mercado/panorama">) {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<ResearchHeaderSkeleton />}>
        <ResearchHeader />
      </Suspense>
      <MarketTabs active="panorama" />
      <Suspense fallback={<ResearchViewSkeleton />}>
        <ResearchView
          searchParams={searchParams}
          modelActions={(filters) => <ModelCatalogActions filters={filters} />}
        />
      </Suspense>
    </div>
  );
}
