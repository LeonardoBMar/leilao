import type { Metadata } from "next";
import { Suspense } from "react";

import {
  ResearchHeader,
  ResearchHeaderSkeleton,
  ResearchView,
  ResearchViewSkeleton,
} from "@/features/research/components/research-view";

export const metadata: Metadata = { title: "Pesquisa · Leilão Tracker" };

export default function ResearchPage({ searchParams }: PageProps<"/pesquisa">) {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<ResearchHeaderSkeleton />}>
        <ResearchHeader />
      </Suspense>
      <Suspense fallback={<ResearchViewSkeleton />}>
        <ResearchView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
