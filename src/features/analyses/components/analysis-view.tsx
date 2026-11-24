import { ArrowLeft, FilePen, GitBranchPlus, GitCompareArrows } from "lucide-react";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { BreadcrumbLink, BreadcrumbPage, Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, Badge, ButtonLink, Section, SectionTitle, Skeleton } from "@/components/ui";
import { calculateMaxBid, FORMULA_VERSION } from "@/domain/finance/calculator";
import { listLotImages } from "@/features/lot-images/queries";
import { getLotMarketReference } from "@/features/research/queries";
import type { LotMarketReference } from "@/features/research/types";
import { formatDate, formatDateTime } from "@/lib/format";

import { getAnalysis, getAnalysisForComparison, listLotAnalyses } from "../queries";
import { analysisCompareSearchSchema, analysisIdSchema } from "../schemas";
import type { AnalysisDetail } from "../types";
import { AnalysisDiffPanel } from "./analysis-diff-panel";
import { AnalysisEditor } from "./analysis-editor";
import { AnalysisHistory } from "./analysis-history";
import { AnalysisReadonly } from "./analysis-readonly";
import { AnalysisVehicleStrip } from "./analysis-vehicle-strip";
import { CreateAnalysisButton } from "./create-analysis-button";

/** Tela da análise (SPEC `/analise/[id]`): rascunho editável ou versão fixada em leitura, mais o histórico. */
export async function AnalysisView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [resolvedParams, resolvedSearch] = await Promise.all([params, searchParams ?? Promise.resolve({})]);
  const parsed = analysisIdSchema.safeParse(resolvedParams.id);
  if (!parsed.success) notFound();
  const analysis = await getAnalysis(parsed.data);
  if (!analysis) notFound();

  const compareId = analysisCompareSearchSchema.parse(resolvedSearch).comparar;
  const [versions, market, lotImages, compared] = await Promise.all([
    listLotAnalyses(analysis.lot.id),
    getLotMarketReference(analysis.lot.id),
    listLotImages(analysis.lot.id),
    compareId && compareId !== analysis.id
      ? getAnalysisForComparison(analysis.lot.id, compareId)
      : Promise.resolve(null),
  ]);

  const isFixed = analysis.status === "fixed";
  const { lot } = analysis;
  const photoUrls = Array.from(
    new Set([
      ...lotImages.flatMap((image) => (image.url === null ? [] : [image.url])),
      ...lot.context.listingPhotoUrls,
    ]),
  );

  const previousVersion = versions.find((item) => item.version < analysis.version) ?? null;
  const draftOutcome = analysis.status === "draft" ? calculateMaxBid(analysis.inputs) : null;
  const currentSnapshot = {
    id: analysis.id,
    version: analysis.version,
    status: analysis.status,
    inputs: analysis.inputs,
    fipeValue: analysis.references.fipeValue,
    maxBid:
      analysis.status === "fixed"
        ? (analysis.outputs?.maxBid ?? null)
        : draftOutcome?.kind === "viable"
          ? draftOutcome.maxBid
          : null,
    isViable:
      analysis.status === "fixed"
        ? (analysis.outputs?.isViable ?? null)
        : draftOutcome === null || draftOutcome.kind === "incomplete"
          ? null
          : draftOutcome.kind === "viable",
    notes: analysis.references.notes,
  };

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

      <AnalysisVehicleStrip title={lot.title} currentBid={lot.currentBid} context={lot.context} photoUrls={photoUrls} />

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

      <Section aria-labelledby="analysis-history" className="grid gap-4 border-t border-border pt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle id="analysis-history">Histórico de versões</SectionTitle>
          {previousVersion && !compared ? (
            <ButtonLink
              href={`/analise/${analysis.id}?comparar=${previousVersion.id}` as Route}
              variant="secondary"
              size="sm"
            >
              <GitCompareArrows aria-hidden="true" className="size-4" />
              Comparar com v{previousVersion.version}
            </ButtonLink>
          ) : null}
        </div>
        {compared ? <AnalysisDiffPanel base={compared} current={currentSnapshot} /> : null}
        <AnalysisHistory versions={versions} currentId={analysis.id} compareId={compared?.id} />
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
