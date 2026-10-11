import type { Metadata } from "next";
import { Suspense } from "react";

import { EvaluateView, EvaluateViewSkeleton } from "@/features/research/components/evaluate-view";
import { MarketTabs } from "@/features/research/components/market-tabs";
import { ResearchHeader, ResearchHeaderSkeleton } from "@/features/research/components/research-view";

import { EvaluateActions } from "./evaluate-actions";
import { openListingAction } from "./open-listing-action";

export const metadata: Metadata = { title: "Mercado · Leilão Tracker" };

export default function EvaluatePage({ searchParams }: PageProps<"/mercado">) {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<ResearchHeaderSkeleton />}>
        <ResearchHeader />
      </Suspense>
      <MarketTabs active="evaluate" />
      <Suspense fallback={<EvaluateViewSkeleton />}>
        <EvaluateView
          searchParams={searchParams}
          openListingAction={openListingAction}
          vehicleActions={(filters) => <EvaluateActions filters={filters} />}
        />
      </Suspense>
    </div>
  );
}
