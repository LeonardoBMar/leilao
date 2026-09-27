import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui";
import { ResultFormView } from "@/features/results/components/result-form-view";

export const metadata: Metadata = { title: "Resultado do lote · Leilão Tracker" };

export default function LotResultPage({ params }: PageProps<"/lotes/[id]/resultado">) {
  return (
    <Suspense fallback={<Skeleton className="h-150 max-w-4xl" />}>
      <ResultFormView params={params} />
    </Suspense>
  );
}
