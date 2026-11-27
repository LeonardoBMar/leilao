import { Skeleton } from "@/components/ui";

export default function ImportLotLoading() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-5 w-52" />
      <Skeleton className="h-16" />
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}
