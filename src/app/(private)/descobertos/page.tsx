import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { CollectorStatusLine, CollectorStatusLineSkeleton } from "@/features/listings/components/collector-status";
import { ListingsView, ListingsViewSkeleton } from "@/features/listings/components/listings-view";

export const metadata: Metadata = { title: "Descobertos · Leilão Tracker" };

export default function DiscoveredPage({ searchParams }: PageProps<"/descobertos">) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Descobertos"
        description="Lotes encontrados automaticamente nos sites de leilão. Valores de mercado são os informados pela fonte."
      />
      <Suspense fallback={<CollectorStatusLineSkeleton />}>
        <CollectorStatusLine />
      </Suspense>
      <Suspense fallback={<ListingsViewSkeleton />}>
        <ListingsView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
