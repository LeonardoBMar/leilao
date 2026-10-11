import { CarFront } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ButtonLink, EmptyState } from "@/components/ui";
import { MarketTabs } from "@/features/research/components/market-tabs";
import { ResearchHeader, ResearchHeaderSkeleton } from "@/features/research/components/research-view";
import { PANORAMA_PATH } from "@/features/research/search";

export const metadata: Metadata = { title: "Mercado · Leilão Tracker" };

export default function EvaluatePage() {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<ResearchHeaderSkeleton />}>
        <ResearchHeader />
      </Suspense>
      <MarketTabs active="evaluate" />
      <EmptyState
        icon={CarFront}
        title="Avaliar um veículo"
        description="Escolha um veículo para ver quanto ele costuma sair em leilão. Enquanto esta aba não fica pronta, o Panorama mostra as vendas por modelo."
        action={
          <ButtonLink href={PANORAMA_PATH} variant="secondary" size="sm">
            Abrir o Panorama
          </ButtonLink>
        }
      />
    </div>
  );
}
