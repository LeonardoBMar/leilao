import type { Metadata } from "next";
import { Suspense } from "react";

import { AnalysisView, AnalysisViewSkeleton } from "@/features/analyses/components/analysis-view";

export const metadata: Metadata = { title: "Análise financeira · Leilão Tracker" };

export default function AnalysisPage({ params, searchParams }: PageProps<"/analise/[id]">) {
  return (
    <Suspense fallback={<AnalysisViewSkeleton />}>
      <AnalysisView params={params} searchParams={searchParams} />
    </Suspense>
  );
}
