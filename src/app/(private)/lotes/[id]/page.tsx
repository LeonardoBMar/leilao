import type { Metadata } from "next";
import { Suspense } from "react";

import { LotAnalysisPanel, LotAnalysisPanelSkeleton } from "@/features/analyses/components/lot-analysis-panel";
import { LotDetailSkeleton, LotDetailView } from "@/features/lots/components/lot-detail-view";
import { LotResultPanel, LotResultPanelSkeleton } from "@/features/results/components/lot-result-panel";
import { entityId } from "@/lib/schemas";

export const metadata: Metadata = { title: "Lote · Leilão Tracker" };

const idSchema = entityId();

export default function LotPage({ params }: PageProps<"/lotes/[id]">) {
  return (
    <Suspense fallback={<LotDetailSkeleton />}>
      <LotDetailView
        params={params}
        analysis={
          <Suspense fallback={<LotAnalysisPanelSkeleton />}>
            <LotAnalysis params={params} />
          </Suspense>
        }
        result={
          <Suspense fallback={<LotResultPanelSkeleton />}>
            <LotResult params={params} />
          </Suspense>
        }
      />
    </Suspense>
  );
}

/** Id inválido não renderiza nada: a ficha já responde com 404. */
async function LotAnalysis({ params }: Pick<PageProps<"/lotes/[id]">, "params">) {
  const parsed = idSchema.safeParse((await params).id);
  return parsed.success ? <LotAnalysisPanel lotId={parsed.data} /> : null;
}

async function LotResult({ params }: Pick<PageProps<"/lotes/[id]">, "params">) {
  const parsed = idSchema.safeParse((await params).id);
  return parsed.success ? <LotResultPanel lotId={parsed.data} /> : null;
}
