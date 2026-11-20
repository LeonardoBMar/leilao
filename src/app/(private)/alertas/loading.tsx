import { LinkTabs, Skeleton } from "@/components/ui";
import { AlertsViewSkeleton } from "@/features/alerts/components/alerts-view";

export default function AlertsLoading() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-14 w-80" />
      <LinkTabs
        label="Seções de alertas"
        tabs={[
          { href: "/alertas", label: "Alertas", active: true },
          { href: "/monitores", label: "Monitores", active: false },
        ]}
      />
      <AlertsViewSkeleton />
    </div>
  );
}
