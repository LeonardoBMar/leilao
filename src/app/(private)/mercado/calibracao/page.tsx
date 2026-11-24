import type { Metadata } from "next";
import { Suspense } from "react";

import { getCalibration } from "@/features/analyses/queries";
import {
  CalibrationView,
  CalibrationViewSkeleton,
  EngineQualityBlock,
  EngineQualityBlockSkeleton,
} from "@/features/research/components/calibration-view";
import { MarketTabs } from "@/features/research/components/market-tabs";
import { ResearchHeader, ResearchHeaderSkeleton } from "@/features/research/components/research-view";
import { getEngineQuality } from "@/features/research/queries/engine-quality";

export const metadata: Metadata = { title: "Calibração · Mercado · Leilão Tracker" };

async function CalibrationSection() {
  const items = await getCalibration();
  return <CalibrationView items={items} />;
}

async function EngineQualitySection() {
  const data = await getEngineQuality();
  if (data === null) return null;
  return <EngineQualityBlock data={data} />;
}

export default function CalibrationPage() {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<ResearchHeaderSkeleton />}>
        <ResearchHeader />
      </Suspense>
      <MarketTabs active="calibration" />
      <Suspense fallback={<CalibrationViewSkeleton />}>
        <CalibrationSection />
      </Suspense>
      <Suspense fallback={<EngineQualityBlockSkeleton />}>
        <EngineQualitySection />
      </Suspense>
    </div>
  );
}
