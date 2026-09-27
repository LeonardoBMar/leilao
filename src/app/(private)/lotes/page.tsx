import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { LotsView, LotsViewSkeleton } from "@/features/lots/components/lot-list";

export const metadata: Metadata = { title: "Lotes · Leilão Tracker" };

export default function LotsPage({ searchParams }: PageProps<"/lotes">) {
  return (
    <div className="grid gap-6">
      <PageHeader title="Lotes" description="Todos os lotes cadastrados. Para adicionar um lote, abra o leilão." />
      <Suspense fallback={<LotsViewSkeleton />}>
        <LotsView searchParams={searchParams} basePath="/lotes" />
      </Suspense>
    </div>
  );
}
