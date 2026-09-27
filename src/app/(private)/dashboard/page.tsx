import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui";
import { UpcomingAuctions, UpcomingAuctionsSkeleton } from "@/features/auctions/components/upcoming-auctions";
import { DashboardSummary, DashboardSummarySkeleton } from "@/features/dashboard/components/dashboard-summary";
import { PendingItems } from "@/features/dashboard/components/pending-items";
import { FollowedLots, FollowedLotsSkeleton } from "@/features/lots/components/followed-lots";

export const metadata: Metadata = { title: "Dashboard · Leilão Tracker" };

/** Visão geral (SPEC §5, DESIGN.md §15.1). Cada seção carrega de forma independente. */
export default function DashboardPage() {
  return (
    <div className="grid gap-10 lg:gap-12">
      <PageHeader
        title="Dashboard"
        description="Visão geral dos leilões e lotes acompanhados."
        actions={
          <ButtonLink href="/leiloes/novo">
            <Plus aria-hidden="true" />
            Novo leilão
          </ButtonLink>
        }
      />

      <Suspense fallback={<DashboardSummarySkeleton />}>
        <DashboardSummary />
      </Suspense>

      <Suspense fallback={null}>
        <PendingItems />
      </Suspense>

      <Section id="followed-lots" title="Lotes acompanhados">
        <Suspense fallback={<FollowedLotsSkeleton />}>
          <FollowedLots />
        </Suspense>
      </Section>

      <Section id="upcoming-auctions" title="Próximos leilões">
        <Suspense fallback={<UpcomingAuctionsSkeleton />}>
          <UpcomingAuctions />
        </Suspense>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <h2 id={id} className="text-heading-2 text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
