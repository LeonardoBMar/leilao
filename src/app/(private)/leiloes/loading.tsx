import { Skeleton } from "@/components/ui";
import { CatalogAuctionsViewSkeleton } from "@/features/listings/components/catalog-auctions-view";

export default function CatalogAuctionsLoading() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-9 w-36" />
      <CatalogAuctionsViewSkeleton />
    </div>
  );
}
