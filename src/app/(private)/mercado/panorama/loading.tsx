import { MarketTabs } from "@/features/research/components/market-tabs";
import { ResearchHeaderSkeleton, ResearchViewSkeleton } from "@/features/research/components/research-view";

export default function MarketPanoramaLoading() {
  return (
    <div className="grid gap-6">
      <ResearchHeaderSkeleton />
      <MarketTabs active="panorama" />
      <ResearchViewSkeleton />
    </div>
  );
}
