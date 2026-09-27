import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui";
import { EditLotView } from "@/features/lots/components/lot-form-views";

export const metadata: Metadata = { title: "Editar lote · Leilão Tracker" };

export default function EditLotPage({ params }: PageProps<"/lotes/[id]/editar">) {
  return (
    <Suspense fallback={<Skeleton className="h-150 max-w-4xl" />}>
      <EditLotView params={params} />
    </Suspense>
  );
}
