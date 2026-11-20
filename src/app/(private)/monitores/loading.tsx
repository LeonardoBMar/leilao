import { LinkTabs, Skeleton } from "@/components/ui";
import { WatchListSkeleton } from "@/features/watches/components/watch-list";

export default function WatchesLoading() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-14 w-80" />
      <LinkTabs
        label="Seções de alertas"
        tabs={[
          { href: "/alertas", label: "Alertas", active: false },
          { href: "/monitores", label: "Monitores", active: true },
        ]}
      />
      <WatchListSkeleton />
    </div>
  );
}
