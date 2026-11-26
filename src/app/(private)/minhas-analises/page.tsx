import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui";
import { MyAnalysesView, MyAnalysesViewSkeleton } from "@/features/lots/components/my-analyses-view";
import { PortfolioView, PortfolioViewSkeleton } from "@/features/post-auction/components/portfolio-view";

export const metadata: Metadata = { title: "Minhas análises · Leilão Tracker" };

export default function MyAnalysesPage({ searchParams }: PageProps<"/minhas-analises">) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Minhas análises"
        description="Os lotes que você levou para análise, os leilões que cadastrou e sua carteira de arrematados."
        actions={
          <ButtonLink href="/minhas-analises/leiloes/novo">
            <Plus aria-hidden="true" />
            Novo leilão
          </ButtonLink>
        }
      />
      <Suspense fallback={<MyAnalysesViewSkeleton />}>
        <MyAnalysesView
          searchParams={searchParams}
          portfolio={
            <Suspense fallback={<PortfolioViewSkeleton />}>
              <PortfolioView />
            </Suspense>
          }
        />
      </Suspense>
    </div>
  );
}
