import type { Metadata } from "next";
import { Suspense } from "react";

import { LotDetailSkeleton, LotDetailView } from "@/features/lots/components/lot-detail-view";

export const metadata: Metadata = { title: "Lote · Leilão Tracker" };

export default function LotPage({ params }: PageProps<"/lotes/[id]">) {
  return (
    <Suspense fallback={<LotDetailSkeleton />}>
      <LotDetailView params={params} />
    </Suspense>
  );
}
