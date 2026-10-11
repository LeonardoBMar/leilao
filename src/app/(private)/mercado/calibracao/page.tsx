import { Target } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { EmptyState } from "@/components/ui";
import { MarketTabs } from "@/features/research/components/market-tabs";
import { ResearchHeader, ResearchHeaderSkeleton } from "@/features/research/components/research-view";

export const metadata: Metadata = { title: "Calibração · Mercado · Leilão Tracker" };

export default function CalibrationPage() {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<ResearchHeaderSkeleton />}>
        <ResearchHeader />
      </Suspense>
      <MarketTabs active="calibration" />
      <EmptyState
        icon={Target}
        title="Calibração em breve"
        description="Aqui você vai ver como seus limites fixados se saíram frente aos arremates: quantos lotes ficaram dentro do limite e onde ele costuma ficar na faixa do mercado."
      />
    </div>
  );
}
