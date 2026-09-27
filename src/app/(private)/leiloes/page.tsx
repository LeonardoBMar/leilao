import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui";
import { AuctionsView, AuctionsViewSkeleton } from "@/features/auctions/components/auction-list";

export const metadata: Metadata = { title: "Leilões · Leilão Tracker" };

export default function AuctionsPage({ searchParams }: PageProps<"/leiloes">) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Leilões"
        description="Eventos acompanhados, com seus lotes e resultados."
        actions={
          <ButtonLink href="/leiloes/novo">
            <Plus aria-hidden="true" />
            Novo leilão
          </ButtonLink>
        }
      />
      <Suspense fallback={<AuctionsViewSkeleton />}>
        <AuctionsView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
