import { Calculator, CalendarDays, Eye, Gavel, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { SectionErrorBoundary } from "@/components/layout/section-error-boundary";
import { ButtonLink, Section, SectionTitle } from "@/components/ui";
import { RecentAlerts } from "@/features/alerts/components/recent-alerts";
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

export const metadata: Metadata = { title: "Visão geral · Leilão Tracker" };

/**
 * Visão geral orientada à próxima decisão (SPEC §5, DESIGN.md §15.1, D-44): o que analisar agora, os acompanhados
 * frente ao limite, os próximos leilões da região, pendências e o indicador. Cada seção carrega e falha de forma
 * independente; as que leem o catálogo compartilham a mesma consulta por requisição.
 */
export default function DashboardPage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-5">
        <PageHeader
          title="Visão geral"
          inlineMeta={
            <Suspense fallback={<CollectorStatusLineSkeleton compact />}>
              <CollectorStatusLine compact />
            </Suspense>
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

        <SectionErrorBoundary title="Resumo operacional indisponível">
          <Suspense fallback={<DashboardKpisSkeleton />}>
            <DashboardKpis />
          </Suspense>
        </SectionErrorBoundary>
      </div>

      {/* Faixas condicionais no topo mantêm a ordem visual idêntica à ordem do DOM em todos os breakpoints. */}
      <div className="grid gap-5 empty:hidden">
        <SectionErrorBoundary title="Alertas indisponíveis">
          <Suspense fallback={null}>
            <RecentAlerts />
          </Suspense>
        </SectionErrorBoundary>

        <SectionErrorBoundary title="Pendências indisponíveis">
          <Suspense fallback={null}>
            <PendingItems />
          </Suspense>
        </SectionErrorBoundary>
      </div>

      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:gap-x-14">
        <div className="grid content-start gap-10">
          <Section className="gap-2">
            <SectionTitle id="followed-lots" className="flex items-center gap-2">
              <Eye aria-hidden="true" className="size-4 shrink-0 text-muted" />
              Lotes acompanhados
            </SectionTitle>
            <SectionErrorBoundary title="Lotes acompanhados indisponíveis">
              <Suspense fallback={<FollowedLotsSkeleton />}>
                <FollowedLots />
              </Suspense>
            </SectionErrorBoundary>
          </Section>

          <Section className="gap-2">
            <SectionTitle id="region-auctions" className="flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted" />
              Próximos leilões na região
            </SectionTitle>
            <SectionErrorBoundary title="Próximos leilões indisponíveis">
              <Suspense fallback={<RegionAuctionsSkeleton />}>
                <RegionAuctions />
              </Suspense>
            </SectionErrorBoundary>
          </Section>
        </div>

        <aside className="grid content-start gap-8" aria-label="Oportunidades para analisar e indicadores">
          <Section className="gap-2">
            <SectionTitle id="to-analyze" className="flex items-center gap-2">
              <Calculator aria-hidden="true" className="size-4 shrink-0 text-muted" />
              Para analisar agora
            </SectionTitle>
            <SectionErrorBoundary title="Sugestões indisponíveis">
              <Suspense fallback={<ToAnalyzeSkeleton />}>
                <ToAnalyze />
              </Suspense>
            </SectionErrorBoundary>
          </Section>

          <SectionErrorBoundary title="Indicador indisponível">
            <Suspense fallback={<DecisionIndicatorSkeleton />}>
              <DecisionIndicator />
            </Suspense>
          </SectionErrorBoundary>
        </aside>
      </div>
    </div>
  );
}
