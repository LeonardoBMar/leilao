import { CalibrationViewSkeleton } from "@/features/research/components/calibration-view";
import { MarketTabs } from "@/features/research/components/market-tabs";
import { ResearchHeaderSkeleton } from "@/features/research/components/research-view";

export default function CalibrationLoading() {
  return (
    <div className="grid gap-6">
      <ResearchHeaderSkeleton />
      <MarketTabs active="calibration" />
      <CalibrationViewSkeleton />
    </div>
  );
}
