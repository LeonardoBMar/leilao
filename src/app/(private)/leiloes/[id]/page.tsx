import type { Metadata } from "next";
import { Suspense } from "react";

import { AuctionDetailSkeleton, AuctionDetailView } from "@/features/auctions/components/auction-detail-view";

export const metadata: Metadata = { title: "Leilão · Leilão Tracker" };

export default function AuctionPage({ params }: PageProps<"/leiloes/[id]">) {
  return (
    <Suspense fallback={<AuctionDetailSkeleton />}>
      <AuctionDetailView params={params} />
    </Suspense>
  );
}
