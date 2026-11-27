import type { Metadata } from "next";
import { Suspense } from "react";

import { getCalibration } from "@/features/analyses/queries";
import {
  CostCalibrationPanel,
  CostCalibrationPanelSkeleton,
} from "@/features/post-auction/components/cost-calibration-panel";
import { getCostCalibration } from "@/features/post-auction/queries";
import { ApplyCalibrationButton } from "@/features/preferences/components/apply-calibration-button";
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

async function CostCalibrationSection() {
  const { summary } = await getCostCalibration();
  return (
    <CostCalibrationPanel
      summary={summary}
      applyControl={<ApplyCalibrationButton suggestions={summary.suggestions} />}
    />
  );
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
      <Suspense fallback={<CostCalibrationPanelSkeleton />}>
        <CostCalibrationSection />
      </Suspense>
      <Suspense fallback={<EngineQualityBlockSkeleton />}>
        <EngineQualitySection />
      </Suspense>
    </div>
  );
}
