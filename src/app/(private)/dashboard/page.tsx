import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { DashboardSummary, DashboardSummarySkeleton } from "@/features/dashboard/components/dashboard-summary";

export const metadata: Metadata = { title: "Dashboard · Leilão Tracker" };

export default function DashboardPage() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Dashboard" description="Visão geral dos leilões e lotes acompanhados." />
      <Suspense fallback={<DashboardSummarySkeleton />}>
        <DashboardSummary />
      </Suspense>
    </div>
  );
}
