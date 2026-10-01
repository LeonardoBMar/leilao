import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink, Section, SectionHeader, SectionTitle } from "@/components/ui";
import { RecentAlerts } from "@/features/alerts/components/recent-alerts";
import { UpcomingAuctions, UpcomingAuctionsSkeleton } from "@/features/auctions/components/upcoming-auctions";
import {
  DashboardCounts,
  DashboardCountsSkeleton,
  DecisionIndicator,
  DecisionIndicatorSkeleton,
} from "@/features/dashboard/components/dashboard-summary";
import { PendingItems } from "@/features/dashboard/components/pending-items";
import { CollectorStatusLine, CollectorStatusLineSkeleton } from "@/features/listings/components/collector-status";
import { FollowedLots, FollowedLotsSkeleton } from "@/features/lots/components/followed-lots";

export const metadata: Metadata = { title: "Dashboard · Leilão Tracker" };

/** Visão geral (SPEC §5, DESIGN.md §15.1). Cada seção carrega de forma independente. */
export default function DashboardPage() {
  return (
    <div className="grid gap-9">
      <PageHeader
        title="Dashboard"
        description={
          <Suspense fallback={<DashboardCountsSkeleton />}>
            <DashboardCounts />
          </Suspense>
        }
        actions={
          <ButtonLink href="/leiloes/novo">
            <Plus aria-hidden="true" />
            Novo leilão
          </ButtonLink>
        }
      />

      {/* Sem alertas não lidos, a seção não aparece: fallback vazio evita um bloco que some depois. */}
      <Suspense fallback={null}>
        <RecentAlerts />
      </Suspense>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:gap-14">
        <div className="grid content-start gap-10">
          <Section aria-labelledby="followed-lots" className="gap-2">
            <SectionHeader>
              <SectionTitle id="followed-lots">Lotes acompanhados</SectionTitle>
              <ButtonLink href="/lotes?acompanhados=1&resultado=sem" variant="link" className="h-auto px-0">
                Ver todos
              </ButtonLink>
            </SectionHeader>
            <Suspense fallback={<FollowedLotsSkeleton />}>
              <FollowedLots />
            </Suspense>
          </Section>

          <Section aria-labelledby="upcoming-auctions" className="gap-2">
            <SectionTitle id="upcoming-auctions">Próximos leilões</SectionTitle>
            <Suspense fallback={<UpcomingAuctionsSkeleton />}>
              <UpcomingAuctions />
            </Suspense>
          </Section>
        </div>

        <aside className="grid content-start gap-5" aria-label="Pendências e indicadores">
          <Suspense fallback={null}>
            <PendingItems />
          </Suspense>

          <Suspense fallback={<DecisionIndicatorSkeleton />}>
            <DecisionIndicator />
          </Suspense>

          <section aria-label="Coleta automática" className="grid gap-3 border-t border-border pt-5">
            <Suspense fallback={<CollectorStatusLineSkeleton />}>
              <CollectorStatusLine />
            </Suspense>
            <ButtonLink href="/descobertos" variant="secondary" className="w-fit">
              Ver descobertos
            </ButtonLink>
          </section>
        </aside>
      </div>
    </div>
  );
}
