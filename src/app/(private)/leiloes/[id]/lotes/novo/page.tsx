import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui";
import { NewLotView } from "@/features/lots/components/lot-form-views";

export const metadata: Metadata = { title: "Novo lote · Leilão Tracker" };

export default function NewLotPage({ params }: PageProps<"/leiloes/[id]/lotes/novo">) {
  return (
    <Suspense fallback={<Skeleton className="h-150 max-w-4xl" />}>
      <NewLotView params={params} />
    </Suspense>
  );
}
