import { Skeleton } from "@/components/ui";
import { DashboardKpisSkeleton, DecisionIndicatorSkeleton } from "@/features/dashboard/components/dashboard-summary";
import { RegionAuctionsSkeleton } from "@/features/dashboard/components/region-auctions";
import { ToAnalyzeSkeleton } from "@/features/dashboard/components/to-analyze";
import { FollowedLotsSkeleton } from "@/features/lots/components/followed-lots";

export default function DashboardLoading() {
  return (
    <div className="grid gap-8" aria-hidden="true">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-9 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <DashboardKpisSkeleton />
      </div>
      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:gap-x-14">
        <div className="grid gap-10">
          <FollowedLotsSkeleton />
          <RegionAuctionsSkeleton />
        </div>
        <div className="grid gap-8">
          <DecisionIndicatorSkeleton />
          <ToAnalyzeSkeleton />
        </div>
      </div>
    </div>
  );
}
