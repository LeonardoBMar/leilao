import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui";
import { AuctionsView, AuctionsViewSkeleton } from "@/features/auctions/components/auction-list";

export const metadata: Metadata = { title: "Leilões · Leilão Tracker" };

export default function AuctionsPage({ searchParams }: PageProps<"/leiloes">) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Leilões"
        description="Eventos acompanhados, com seus lotes e resultados."
        actions={
          <Button asChild>
            <Link href="/leiloes/novo">
              <Plus aria-hidden="true" />
              Novo leilão
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<AuctionsViewSkeleton />}>
        <AuctionsView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
