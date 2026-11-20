import { EvaluateViewSkeleton } from "@/features/research/components/evaluate-view";
import { MarketTabs } from "@/features/research/components/market-tabs";
import { ResearchHeaderSkeleton } from "@/features/research/components/research-view";

export default function MarketEvaluateLoading() {
  return (
    <div className="grid gap-6">
      <ResearchHeaderSkeleton />
      <MarketTabs active="evaluate" />
      <EvaluateViewSkeleton />
    </div>
  );
}
