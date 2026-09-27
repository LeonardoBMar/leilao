import type { Metadata } from "next";
import { Suspense } from "react";

import { AuctionDetailSkeleton, AuctionDetailView } from "@/features/auctions/components/auction-detail-view";
import { LotsView, LotsViewSkeleton } from "@/features/lots/components/lot-list";
import { entityId } from "@/lib/schemas";

export const metadata: Metadata = { title: "Leilão · Leilão Tracker" };

const idSchema = entityId();

export default function AuctionPage({ params, searchParams }: PageProps<"/leiloes/[id]">) {
  return (
    <Suspense fallback={<AuctionDetailSkeleton />}>
      <AuctionDetailView
        params={params}
        lots={
          <Suspense fallback={<LotsViewSkeleton />}>
            <AuctionLots params={params} searchParams={searchParams} />
          </Suspense>
        }
      />
    </Suspense>
  );
}

/** Lotes do leilão. Id inválido não renderiza nada: o detalhe já responde com 404. */
async function AuctionLots({ params, searchParams }: PageProps<"/leiloes/[id]">) {
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) return null;
  return <LotsView searchParams={searchParams} basePath={`/leiloes/${parsed.data}`} auctionId={parsed.data} />;
}
