import { FilePen, GitBranchPlus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, Badge, Button, Skeleton } from "@/components/ui";
import { FORMULA_VERSION } from "@/domain/finance/calculator";
import { formatDateTime } from "@/lib/format";

import { getAnalysis, listLotAnalyses } from "../queries";
import { analysisIdSchema } from "../schemas";
import { AnalysisEditor } from "./analysis-editor";
import { AnalysisHistory } from "./analysis-history";
import { AnalysisReadonly } from "./analysis-readonly";
import { CreateAnalysisButton } from "./create-analysis-button";

/** Tela da análise (SPEC `/analise/[id]`): rascunho editável ou versão fixada em leitura, mais o histórico. */
export async function AnalysisView({ params }: { params: Promise<{ id: string }> }) {
  const parsed = analysisIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const analysis = await getAnalysis(parsed.data);
  if (!analysis) notFound();
  const versions = await listLotAnalyses(analysis.lot.id);

  const isFixed = analysis.status === "fixed";
  const { lot } = analysis;

  return (
    <div className="grid gap-6">
      <nav aria-label="Trilha" className="text-caption text-muted">
        <Link href={`/leiloes/${lot.auction.id}`} className="hover:text-foreground hover:underline">
          {lot.auction.name}
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/lotes/${lot.id}`} className="hover:text-foreground hover:underline">
          Lote {lot.lotNumber}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">Análise v{analysis.version}</span>
      </nav>

      <PageHeader
        eyebrow={`Lote ${lot.lotNumber} · ${lot.title}`}
        title={`Análise financeira v${analysis.version}`}
        description={
          isFixed && analysis.fixedAt
            ? `Fixada em ${formatDateTime(analysis.fixedAt)} · fórmula v${analysis.outputs?.formulaVersion ?? "?"}`
            : `Rascunho atualizado em ${formatDateTime(analysis.updatedAt)}`
        }
        actions={
          isFixed ? (
            analysis.openDraftId ? (
              <Button asChild>
                <Link href={`/analise/${analysis.openDraftId}`}>
                  <FilePen aria-hidden="true" />
                  Continuar rascunho
                </Link>
              </Button>
            ) : (
              <CreateAnalysisButton lotId={lot.id} sourceId={analysis.id}>
                <GitBranchPlus aria-hidden="true" />
                Criar nova versão
              </CreateAnalysisButton>
            )
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        {isFixed ? <Badge variant="success">Fixada</Badge> : <Badge>Rascunho</Badge>}
        {analysis.references.knownResultAtCreation ? <Badge variant="warning">Retrospectiva</Badge> : null}
      </div>

      {analysis.references.knownResultAtCreation ? (
        <Alert variant="warning">
          <AlertDescription>
            Análise feita conhecendo o resultado do lote. Ela pode ser consultada, mas não entra no indicador de
            decisões anteriores ao resultado.
          </AlertDescription>
        </Alert>
      ) : null}

      {isFixed && analysis.outputs && analysis.outputs.formulaVersion !== FORMULA_VERSION ? (
        <Alert variant="info">
          <AlertDescription>
            Esta versão foi calculada com a fórmula v{analysis.outputs.formulaVersion}. O limite preservado não é
            recalculado; apenas a simulação usa a fórmula atual.
          </AlertDescription>
        </Alert>
      ) : null}

      {isFixed ? <AnalysisReadonly analysis={analysis} /> : <AnalysisEditor analysis={analysis} />}

      <section aria-labelledby="analysis-history" className="grid gap-4">
        <h2 id="analysis-history" className="text-heading-2 text-foreground">
          Histórico de versões
        </h2>
        <AnalysisHistory versions={versions} currentId={analysis.id} />
      </section>
    </div>
  );
}

export function AnalysisViewSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-20" />
      <div className="grid gap-6 xl:grid-cols-12">
        <Skeleton className="h-150 xl:col-span-7" />
        <Skeleton className="h-96 xl:col-span-5" />
      </div>
    </div>
  );
}
