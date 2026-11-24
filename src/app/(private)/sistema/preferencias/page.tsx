import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { PreferencesSkeleton, PreferencesView } from "@/features/preferences/components/preferences-view";
import { AdminSystemTabs } from "@/features/system/components/system-tabs";

export const metadata: Metadata = { title: "Preferências · Leilão Tracker" };

export default function SystemPreferencesPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Preferências"
        description="Região-base para distâncias e alertas, além das premissas padrão usadas nas análises financeiras."
      />
      <Suspense fallback={<PreferencesSkeleton />}>
        <AdminSystemTabs active="preferences" />
        <PreferencesView />
      </Suspense>
    </div>
  );
}
