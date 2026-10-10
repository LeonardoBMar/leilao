import { Calculator, FilePen } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ButtonLink } from "@/components/ui";
import { CreateAnalysisButton } from "@/features/analyses/components/create-analysis-button";
import { LotAnalysisPanel, LotAnalysisPanelSkeleton } from "@/features/analyses/components/lot-analysis-panel";
import { listLotAnalyses } from "@/features/analyses/queries";
import { LotPhotosPanel, LotPhotosPanelSkeleton } from "@/features/lot-images/components/lot-photos-panel";
import { LotDetailSkeleton, LotDetailView } from "@/features/lots/components/lot-detail-view";
import { LotResearchLink } from "@/features/research/components/lot-research-link";
import { LotResultPanel, LotResultPanelSkeleton } from "@/features/results/components/lot-result-panel";
import { RecordResultButton } from "@/features/results/components/record-result-button";
import { getLotResultContext } from "@/features/results/queries";
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
        nextAction={
          <Suspense fallback={null}>
            <LotNextAction params={params} />
          </Suspense>
        }
        photos={
          <Suspense fallback={<LotPhotosPanelSkeleton />}>
            <LotPhotos params={params} />
          </Suspense>
        }
        research={
          <Suspense fallback={null}>
            <LotResearch params={params} />
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

async function LotResearch({ params }: Pick<PageProps<"/lotes/[id]">, "params">) {
  const parsed = idSchema.safeParse((await params).id);
  return parsed.success ? <LotResearchLink lotId={parsed.data} /> : null;
}

async function LotPhotos({ params }: Pick<PageProps<"/lotes/[id]">, "params">) {
  const parsed = idSchema.safeParse((await params).id);
  return parsed.success ? <LotPhotosPanel lotId={parsed.data} /> : null;
}

/**
 * Próximo passo do lote em destaque no cabeçalho: analisar, continuar o rascunho ou, com análise fixada e o leilão
 * já começado, registrar o resultado. Fora disso, nada (as ações ficam nos blocos).
 */
async function LotNextAction({ params }: Pick<PageProps<"/lotes/[id]">, "params">) {
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) return null;
  const lotId = parsed.data;

  const versions = await listLotAnalyses(lotId);
  const draft = versions.find((version) => version.status === "draft");
  if (draft) {
    return (
      <ButtonLink href={`/analise/${draft.id}`}>
        <FilePen aria-hidden="true" />
        Continuar rascunho
      </ButtonLink>
    );
  }
  if (versions.length === 0) {
    return (
      <CreateAnalysisButton lotId={lotId}>
        <Calculator aria-hidden="true" />
        Analisar lote
      </CreateAnalysisButton>
    );
  }

  const context = await getLotResultContext(lotId);
  if (!context || context.current || context.lot.auction.startsAt > new Date()) return null;
  return <RecordResultButton lotId={lotId} variant="primary" />;
}
