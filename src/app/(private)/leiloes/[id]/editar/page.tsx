import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui";
import { AuctionEditView } from "@/features/auctions/components/auction-edit-view";

export const metadata: Metadata = { title: "Editar leilão · Leilão Tracker" };

export default function EditAuctionPage({ params }: PageProps<"/leiloes/[id]/editar">) {
  return (
    <Suspense fallback={<Skeleton className="h-150 max-w-4xl" />}>
      <AuctionEditView params={params} />
    </Suspense>
  );
}
