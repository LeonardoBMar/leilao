import { Calculator, CalendarDays, Eye, Gavel, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
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

export const metadata: Metadata = { title: "Dashboard · Leilão Tracker" };

/**
 * Visão geral orientada à próxima decisão (SPEC §5, DESIGN.md §15.1, D-44): o que analisar agora, os acompanhados
 * frente ao limite, os próximos leilões da região e, na lateral, pendências e o indicador. Cada seção carrega de forma
 * independente; as que leem o catálogo compartilham a mesma consulta por requisição.
 */
export default function DashboardPage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-5">
        <PageHeader
          title="Dashboard"
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

        <Suspense fallback={<DashboardKpisSkeleton />}>
          <DashboardKpis />
        </Suspense>
      </div>

      {/* Sem alertas não lidos, a seção não aparece: fallback vazio evita um bloco que some depois. */}
      <Suspense fallback={null}>
        <RecentAlerts />
      </Suspense>

      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr] xl:gap-x-14 xl:gap-y-0">
        <div className="order-first grid content-start empty:hidden xl:order-none xl:col-start-2 xl:row-start-1 xl:pb-5">
          <Suspense fallback={null}>
            <PendingItems />
          </Suspense>
        </div>

        <div className="grid content-start gap-10 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <Section aria-labelledby="followed-lots" className="gap-2">
            <SectionTitle id="followed-lots" className="flex scroll-mt-20 items-center gap-2">
              <Eye aria-hidden="true" className="size-4 shrink-0 text-muted" />
              Lotes acompanhados
            </SectionTitle>
            <Suspense fallback={<FollowedLotsSkeleton />}>
              <FollowedLots />
            </Suspense>
          </Section>

          <Section aria-labelledby="to-analyze" className="gap-2">
            <SectionTitle id="to-analyze" className="flex scroll-mt-20 items-center gap-2">
              <Calculator aria-hidden="true" className="size-4 shrink-0 text-muted" />
              Para analisar agora
            </SectionTitle>
            <Suspense fallback={<ToAnalyzeSkeleton />}>
              <ToAnalyze />
            </Suspense>
          </Section>

          <Section aria-labelledby="region-auctions" className="gap-2">
            <SectionTitle id="region-auctions" className="flex scroll-mt-20 items-center gap-2">
              <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted" />
              Próximos leilões na região
            </SectionTitle>
            <Suspense fallback={<RegionAuctionsSkeleton />}>
              <RegionAuctions />
            </Suspense>
          </Section>
        </div>

        <aside
          className="grid content-start gap-5 xl:col-start-2 xl:row-start-2"
          aria-label="Indicadores e coleta automática"
        >
          <Suspense fallback={<DecisionIndicatorSkeleton />}>
            <DecisionIndicator />
          </Suspense>

          <section aria-label="Coleta automática" className="border-t border-border pt-5">
            <Suspense fallback={<CollectorStatusLineSkeleton />}>
              <CollectorStatusLine />
            </Suspense>
          </section>
        </aside>
      </div>
    </div>
  );
}
