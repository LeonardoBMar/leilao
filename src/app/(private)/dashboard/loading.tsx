import { Skeleton } from "@/components/ui";
import { DashboardKpisSkeleton, DecisionIndicatorSkeleton } from "@/features/dashboard/components/dashboard-summary";
import { RegionAuctionsSkeleton } from "@/features/dashboard/components/region-auctions";
import { ToAnalyzeSkeleton } from "@/features/dashboard/components/to-analyze";
import { CollectorStatusLineSkeleton } from "@/features/listings/components/collector-status";
import { FollowedLotsSkeleton } from "@/features/lots/components/followed-lots";

export default function DashboardLoading() {
  return (
    <div className="grid gap-8" aria-hidden="true">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <Skeleton className="h-9 w-28" />
            <CollectorStatusLineSkeleton compact />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32 sm:h-9" />
            <Skeleton className="h-10 w-32 sm:h-9" />
          </div>
        </div>
        <DashboardKpisSkeleton />
      </div>
      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:gap-x-14">
        <div className="grid gap-10">
          <div className="grid gap-3">
            <Skeleton className="h-6 w-44" />
            <ToAnalyzeSkeleton />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-6 w-44" />
            <FollowedLotsSkeleton />
          </div>
          <div className="grid gap-3">
            <Skeleton className="h-6 w-56" />
            <RegionAuctionsSkeleton />
          </div>
        </div>
        <div className="grid gap-8">
          <DecisionIndicatorSkeleton />
        </div>
      </div>
    </div>
  );
}
