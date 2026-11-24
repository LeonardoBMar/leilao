import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { PreferencesSkeleton, PreferencesView } from "@/features/preferences/components/preferences-view";
import { SystemTabs } from "@/features/system/components/system-tabs";

export const metadata: Metadata = { title: "Preferências · Sistema · Leilão Tracker" };

export default function SystemPreferencesPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Sistema"
        description="Saúde da coleta automática, correções FIPE e preferências de região e premissas padrão."
      />
      <SystemTabs active="preferences" />
      <Suspense fallback={<PreferencesSkeleton />}>
        <PreferencesView />
      </Suspense>
    </div>
  );
}
