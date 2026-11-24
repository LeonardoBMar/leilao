import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { FipeQueueSkeleton, FipeQueueView } from "@/features/system/components/fipe-queue-view";
import { SystemTabs } from "@/features/system/components/system-tabs";

export const metadata: Metadata = { title: "Correções FIPE · Sistema · Leilão Tracker" };

export default function SystemFipePage({ searchParams }: PageProps<"/sistema/fipe">) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Sistema"
        description="Saúde da coleta automática por fonte e correção manual de correlações FIPE."
      />
      <SystemTabs active="fipe" />
      <Suspense fallback={<FipeQueueSkeleton />}>
        <FipeQueueView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
