import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { CollectorSourcesSkeleton, CollectorSourcesView } from "@/features/system/components/collector-sources-view";
import { SystemTabs } from "@/features/system/components/system-tabs";

export const metadata: Metadata = { title: "Coleta · Sistema · Leilão Tracker" };

export default function SystemCollectorPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Sistema"
        description="Saúde da coleta automática por fonte e correção manual de correlações FIPE."
      />
      <SystemTabs active="collector" />
      <Suspense fallback={<CollectorSourcesSkeleton />}>
        <CollectorSourcesView />
      </Suspense>
    </div>
  );
}
