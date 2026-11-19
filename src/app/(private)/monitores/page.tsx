import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink, LinkTabs } from "@/components/ui";
import { WatchList, WatchListSkeleton } from "@/features/watches/components/watch-list";

export const metadata: Metadata = { title: "Monitores · Leilão Tracker" };

export default function WatchesPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Alertas"
        description="Buscas salvas. A cada coleta, lotes novos que combinam viram alertas."
        actions={
          <ButtonLink href="/monitores/novo">
            <Plus aria-hidden="true" />
            Novo monitor
          </ButtonLink>
        }
      />
      <LinkTabs
        label="Seções de alertas"
        tabs={[
          { href: "/alertas", label: "Alertas", active: false },
          { href: "/monitores", label: "Monitores", active: true },
        ]}
      />
      <Suspense fallback={<WatchListSkeleton />}>
        <WatchList />
      </Suspense>
    </div>
  );
}
