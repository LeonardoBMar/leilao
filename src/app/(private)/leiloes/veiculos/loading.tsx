import { Skeleton } from "@/components/ui";
import { ListingsViewSkeleton } from "@/features/listings/components/listings-view";

export default function CatalogListingsLoading() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-14 w-72" />
      <ListingsViewSkeleton />
    </div>
  );
}
