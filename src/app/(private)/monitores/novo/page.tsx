import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { WatchNewView, WatchNewViewSkeleton } from "@/features/watches/components/watch-new-view";

export const metadata: Metadata = { title: "Novo monitor · Leilão Tracker" };

export default function NewWatchPage({ searchParams }: PageProps<"/monitores/novo">) {
  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader
        title="Novo monitor"
        description="Preencha pelo menos marca ou modelo, um ano ou o preço. O resto é opcional."
      />
      <Suspense fallback={<WatchNewViewSkeleton />}>
        <WatchNewView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
