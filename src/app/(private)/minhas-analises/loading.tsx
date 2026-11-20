import { Skeleton } from "@/components/ui";
import { MyAnalysesViewSkeleton } from "@/features/lots/components/my-analyses-view";

export default function MyAnalysesLoading() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-14 w-80" />
      <MyAnalysesViewSkeleton />
    </div>
  );
}
