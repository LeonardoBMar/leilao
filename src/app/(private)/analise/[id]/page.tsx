import type { Metadata } from "next";
import { Suspense } from "react";

import { AnalysisView, AnalysisViewSkeleton } from "@/features/analyses/components/analysis-view";
import { LotResearchLink } from "@/features/research/components/lot-research-link";

export const metadata: Metadata = { title: "Análise financeira · Leilão Tracker" };

export default function AnalysisPage({ params }: PageProps<"/analise/[id]">) {
  return (
    <Suspense fallback={<AnalysisViewSkeleton />}>
      <AnalysisView params={params} research={(lotId) => <LotResearchLink lotId={lotId} variant="secondary" />} />
    </Suspense>
  );
}
