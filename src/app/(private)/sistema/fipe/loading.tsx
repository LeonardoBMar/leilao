import { PageHeader } from "@/components/layout/page-header";
import { FipeQueueSkeleton } from "@/features/system/components/fipe-queue-view";
import { SystemTabs } from "@/features/system/components/system-tabs";

export default function SystemFipeLoading() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Sistema"
        description="Saúde da coleta automática por fonte e correção manual de correlações FIPE."
      />
      <SystemTabs active="fipe" />
      <FipeQueueSkeleton />
    </div>
  );
}
