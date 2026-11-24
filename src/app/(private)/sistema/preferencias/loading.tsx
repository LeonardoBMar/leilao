import { PageHeader } from "@/components/layout/page-header";
import { PreferencesSkeleton } from "@/features/preferences/components/preferences-view";
import { SystemTabs } from "@/features/system/components/system-tabs";

export default function SystemPreferencesLoading() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Sistema"
        description="Saúde da coleta automática, correções FIPE e preferências de região e premissas padrão."
      />
      <SystemTabs active="preferences" />
      <PreferencesSkeleton />
    </div>
  );
}
