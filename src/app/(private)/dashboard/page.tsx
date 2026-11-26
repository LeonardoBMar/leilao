import { Calculator, CalendarDays, Eye, Gavel, Plus } from "lucide-react";
import type { Metadata, Route } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { SectionErrorBoundary } from "@/components/layout/section-error-boundary";
import { Alert, AlertDescription, AlertTitle, ButtonLink, Section, SectionTitle } from "@/components/ui";
import { DashboardGuidePopover } from "@/features/dashboard/components/dashboard-guide-popover";
import {
  DashboardKpis,
  DashboardKpisSkeleton,
  DecisionIndicator,
  DecisionIndicatorSkeleton,
} from "@/features/dashboard/components/dashboard-summary";
import { PendingItems } from "@/features/dashboard/components/pending-items";
import { RegionAuctions, RegionAuctionsSkeleton } from "@/features/dashboard/components/region-auctions";
import { ToAnalyze, ToAnalyzeSkeleton } from "@/features/dashboard/components/to-analyze";
import { CollectorStatusLine, CollectorStatusLineSkeleton } from "@/features/listings/components/collector-status";
import { FollowedLots, FollowedLotsSkeleton } from "@/features/lots/components/followed-lots";

export const metadata: Metadata = { title: "Início · Leilão Tracker" };

const ALL_FOLLOWED_HREF = "/minhas-analises?acompanhados=1&resultado=sem" as Route;

async function DashboardNotice({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const { aviso } = await searchParams;
  if (aviso !== "sem-permissao") return null;

  return (
    <Alert variant="warning">
      <AlertTitle>Acesso restrito</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>As páginas operacionais de coleta e correções FIPE são exclusivas para administradores.</span>
        <ButtonLink href="/dashboard" replace variant="secondary" size="sm" className="min-h-10 sm:min-h-8">
          Dispensar
        </ButtonLink>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Visão geral orientada à próxima decisão (SPEC §5, DESIGN.md §15.1, D-44): o que analisar agora, os acompanhados
 * frente ao limite, os próximos leilões da região, pendências e o indicador. Cada seção carrega e falha de forma
 * independente; as que leem o catálogo compartilham a mesma consulta por requisição.
 */
export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-5">
        <PageHeader
          title="Início"
          inlineMeta={
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Suspense fallback={<CollectorStatusLineSkeleton compact />}>
                <CollectorStatusLine compact />
              </Suspense>
              <DashboardGuidePopover />
            </div>
          }
          actions={
            <>
              <ButtonLink href="/minhas-analises/leiloes/novo" variant="secondary">
                <Plus aria-hidden="true" />
                Novo leilão
              </ButtonLink>
              <ButtonLink href="/leiloes">
                <Gavel aria-hidden="true" />
                Ver leilões
              </ButtonLink>
            </>
          }
        />

        <div className="empty:hidden">
          <Suspense fallback={null}>
            <DashboardNotice searchParams={searchParams} />
          </Suspense>
        </div>

        <SectionErrorBoundary title="Resumo operacional indisponível">
          <Suspense fallback={<DashboardKpisSkeleton />}>
            <DashboardKpis />
          </Suspense>
        </SectionErrorBoundary>
      </div>

      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:gap-x-14">
        <div className="grid content-start gap-10">
          <Section
            id="to-analyze"
            tabIndex={-1}
            className="scroll-mt-20 gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
          >
            <div className="grid gap-1">
              <SectionTitle className="flex items-center gap-2">
                <Calculator aria-hidden="true" className="size-4 shrink-0 text-muted" />
                Para analisar agora
              </SectionTitle>
              <p className="text-caption text-muted">
                Lotes abertos na sua região-base ou nos seus monitores cujo preço provável cabe no limite estimado.
              </p>
            </div>
            <SectionErrorBoundary
              title="Sugestões indisponíveis"
              fallbackHref="/leiloes/veiculos"
              fallbackLabel="Abrir catálogo"
            >
              <Suspense fallback={<ToAnalyzeSkeleton />}>
                <ToAnalyze />
              </Suspense>
            </SectionErrorBoundary>
          </Section>

          <Section
            id="followed-lots"
            tabIndex={-1}
            className="scroll-mt-20 gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
          >
            <SectionTitle className="flex items-center gap-2">
              <Eye aria-hidden="true" className="size-4 shrink-0 text-muted" />
              Lotes acompanhados
            </SectionTitle>
            <SectionErrorBoundary
              title="Lotes acompanhados indisponíveis"
              fallbackHref={ALL_FOLLOWED_HREF}
              fallbackLabel="Ver acompanhados"
            >
              <Suspense fallback={<FollowedLotsSkeleton />}>
                <FollowedLots />
              </Suspense>
            </SectionErrorBoundary>
          </Section>

          <Section
            id="region-auctions"
            tabIndex={-1}
            className="scroll-mt-20 gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
          >
            <div className="grid gap-1">
              <SectionTitle className="flex items-center gap-2">
                <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted" />
                Próximos leilões na região
              </SectionTitle>
              <p className="text-caption text-muted">
                Leilões do catálogo nos próximos 7 dias dentro do seu filtro ou monitores.
              </p>
            </div>
            <SectionErrorBoundary
              title="Próximos leilões indisponíveis"
              fallbackHref="/leiloes"
              fallbackLabel="Abrir Leilões"
            >
              <Suspense fallback={<RegionAuctionsSkeleton />}>
                <RegionAuctions />
              </Suspense>
            </SectionErrorBoundary>
          </Section>
        </div>

        <aside className="grid content-start gap-8" aria-label="Indicadores e pendências">
          <SectionErrorBoundary
            title="Indicador indisponível"
            fallbackHref="/mercado/calibracao"
            fallbackLabel="Ver calibração"
          >
            <Suspense fallback={<DecisionIndicatorSkeleton />}>
              <DecisionIndicator />
            </Suspense>
          </SectionErrorBoundary>

          <SectionErrorBoundary
            title="Pendências indisponíveis"
            fallbackHref="/minhas-analises"
            fallbackLabel="Abrir Minhas análises"
          >
            <Suspense fallback={null}>
              <PendingItems />
            </Suspense>
          </SectionErrorBoundary>
        </aside>
      </div>
    </div>
  );
}
