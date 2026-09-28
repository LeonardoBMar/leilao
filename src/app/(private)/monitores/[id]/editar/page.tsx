import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui";
import { WatchEditView } from "@/features/watches/components/watch-edit-view";

export const metadata: Metadata = { title: "Editar monitor · Leilão Tracker" };

export default function EditWatchPage({ params }: PageProps<"/monitores/[id]/editar">) {
  return (
    <Suspense fallback={<Skeleton className="h-150 max-w-4xl" />}>
      <WatchEditView params={params} />
    </Suspense>
  );
}
