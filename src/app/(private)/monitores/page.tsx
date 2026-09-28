import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui";
import { WatchList, WatchListSkeleton } from "@/features/watches/components/watch-list";

export const metadata: Metadata = { title: "Monitores · Leilão Tracker" };

export default function WatchesPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Monitores"
        description="Buscas salvas. A cada coleta, lotes novos que combinam viram alertas."
        actions={
          <ButtonLink href="/monitores/novo">
            <Plus aria-hidden="true" />
            Novo monitor
          </ButtonLink>
        }
      />
      <Suspense fallback={<WatchListSkeleton />}>
        <WatchList />
      </Suspense>
    </div>
  );
}
