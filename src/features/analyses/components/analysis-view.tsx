import { ArrowLeft, FilePen, GitBranchPlus } from "lucide-react";
import { notFound } from "next/navigation";

import { BreadcrumbLink, BreadcrumbPage, Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, Badge, ButtonLink, Section, SectionTitle, Skeleton } from "@/components/ui";
import { FORMULA_VERSION } from "@/domain/finance/calculator";
import { getLotMarketReference } from "@/features/research/queries";
import type { LotMarketReference } from "@/features/research/types";
import { formatDate, formatDateTime } from "@/lib/format";

import { getAnalysis, listLotAnalyses } from "../queries";
import { analysisIdSchema } from "../schemas";
import type { AnalysisDetail } from "../types";
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
  const [versions, market] = await Promise.all([
    listLotAnalyses(analysis.lot.id),
    getLotMarketReference(analysis.lot.id),
  ]);

  const isFixed = analysis.status === "fixed";
  const { lot } = analysis;

  return (
    <div className="grid gap-7">
      <Breadcrumbs>
        <BreadcrumbLink href={`/minhas-analises/leiloes/${lot.auction.id}`}>{lot.auction.name}</BreadcrumbLink>
        <BreadcrumbLink href={`/lotes/${lot.id}`}>Lote {lot.lotNumber}</BreadcrumbLink>
        <BreadcrumbPage>Análise v{analysis.version}</BreadcrumbPage>
      </Breadcrumbs>

      <PageHeader
        eyebrow={`Lote ${lot.lotNumber} · ${lot.title}`}
        title={
          <>
            Análise financeira <span className="font-mono font-medium text-muted">v{analysis.version}</span>
          </>
        }
        meta={
          <>
            {isFixed ? <Badge>Fixada</Badge> : <Badge variant="warning">Rascunho</Badge>}
            {analysis.references.knownResultAtCreation ? <Badge variant="warning">Retrospectiva</Badge> : null}
            <span className="ml-1">
              {isFixed && analysis.fixedAt
                ? `Fixada em ${formatDateTime(analysis.fixedAt)}`
                : `Rascunho atualizado em ${formatDateTime(analysis.updatedAt)}`}
            </span>
          </>
        }
        actions={
          <>
            <ButtonLink href={`/lotes/${lot.id}`} variant="secondary">
              <ArrowLeft aria-hidden="true" />
              Ver lote
            </ButtonLink>
            {isFixed ? (
              analysis.openDraftId ? (
                <ButtonLink href={`/analise/${analysis.openDraftId}`}>
                  <FilePen aria-hidden="true" />
                  Continuar rascunho
                </ButtonLink>
              ) : (
                <CreateAnalysisButton lotId={lot.id} sourceId={analysis.id} variant="secondary">
                  <GitBranchPlus aria-hidden="true" />
                  Criar nova versão
                </CreateAnalysisButton>
              )
            ) : null}
          </>
        }
      />

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

      {isFixed ? (
        <AnalysisReadonly analysis={analysis} {...fixedMarket(analysis, market)} />
      ) : (
        <AnalysisEditor analysis={analysis} market={market} />
      )}

      <Section aria-labelledby="analysis-history" className="border-t border-border pt-7">
        <SectionTitle id="analysis-history">Histórico de versões</SectionTitle>
        <AnalysisHistory versions={versions} currentId={analysis.id} />
      </Section>
    </div>
  );
}

/**
 * Concorrência da versão fixada: as vendas da época (snapshot, D-74) com o link de hoje para o Avaliar; nas fixadas
 * antes do registro, as vendas de hoje, com o aviso.
 */
function fixedMarket(
  analysis: AnalysisDetail,
  current: LotMarketReference | null,
): { market: LotMarketReference | null; marketNote: string } {
  const snapshot = analysis.marketSnapshot;
  if (snapshot === null) {
    return { market: current, marketNote: "Vendas de hoje: esta versão foi fixada antes do registro do mercado." };
  }
  return {
    market: {
      level: snapshot.level,
      scope: snapshot.scope,
      href: current?.href ?? "/mercado",
      sales: snapshot.sales,
      band: snapshot.band,
    },
    marketNote: `Vendas até a fixação, em ${formatDate(snapshot.computedAt)}.`,
  };
}

export function AnalysisViewSkeleton() {
  return (
    <div className="grid gap-7" aria-hidden="true">
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-20" />
      <div className="grid gap-9 xl:grid-cols-[minmax(0,1fr)_28.75rem] xl:gap-14">
        <Skeleton className="h-150" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
