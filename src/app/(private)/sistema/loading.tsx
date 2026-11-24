import { PageHeader } from "@/components/layout/page-header";
import { CollectorSourcesSkeleton } from "@/features/system/components/collector-sources-view";
import { SystemTabs } from "@/features/system/components/system-tabs";

export default function SystemCollectorLoading() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Sistema"
        description="Saúde da coleta automática por fonte e correção manual de correlações FIPE."
      />
      <SystemTabs active="collector" />
      <CollectorSourcesSkeleton />
    </div>
  );
}
