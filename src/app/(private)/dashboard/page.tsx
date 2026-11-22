import { Calculator, CalendarDays, Eye, Gavel, Plus } from "lucide-react";
import type { Metadata, Route } from "next";
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
import { PendingItems, PendingItemsSkeleton } from "@/features/dashboard/components/pending-items";
import { RegionAuctions, RegionAuctionsSkeleton } from "@/features/dashboard/components/region-auctions";
import { ToAnalyze, ToAnalyzeSkeleton } from "@/features/dashboard/components/to-analyze";
import { CollectorStatusLine, CollectorStatusLineSkeleton } from "@/features/listings/components/collector-status";
import { FollowedLots, FollowedLotsSkeleton } from "@/features/lots/components/followed-lots";

export const metadata: Metadata = { title: "Visão geral · Leilão Tracker" };

const ALL_FOLLOWED_HREF = "/minhas-analises?acompanhados=1&resultado=sem" as Route;

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

      <div className="empty:hidden">
        <SectionErrorBoundary title="Alertas indisponíveis" fallbackHref="/alertas" fallbackLabel="Abrir Alertas">
          <Suspense fallback={null}>
            <RecentAlerts />
          </Suspense>
        </SectionErrorBoundary>
      </div>

      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:gap-x-14">
        <div className="grid content-start gap-10">
          <Section id="to-analyze" className="scroll-mt-20 gap-3">
            <div className="grid gap-1">
              <SectionTitle className="flex items-center gap-2">
                <Calculator aria-hidden="true" className="size-4 shrink-0 text-muted" />
                Para analisar agora
              </SectionTitle>
              <p className="text-caption text-muted">
                Lotes abertos até 150 km ou nos seus monitores cujo preço provável cabe no limite estimado.
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

          <Section id="followed-lots" className="scroll-mt-20 gap-2">
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

          <Section id="region-auctions" className="scroll-mt-20 gap-3">
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

        <aside className="grid content-start gap-8" aria-label="Pendências e indicadores">
          <SectionErrorBoundary
            title="Pendências indisponíveis"
            fallbackHref="/minhas-analises"
            fallbackLabel="Abrir Minhas análises"
          >
            <Suspense fallback={<PendingItemsSkeleton />}>
              <PendingItems />
            </Suspense>
          </SectionErrorBoundary>

          <SectionErrorBoundary
            title="Indicador indisponível"
            fallbackHref="/mercado/calibracao"
            fallbackLabel="Ver calibração"
          >
            <Suspense fallback={<DecisionIndicatorSkeleton />}>
              <DecisionIndicator />
            </Suspense>
          </SectionErrorBoundary>
        </aside>
      </div>
    </div>
  );
}
