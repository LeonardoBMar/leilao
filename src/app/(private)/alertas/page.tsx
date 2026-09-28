import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui";
import { AlertsView, AlertsViewSkeleton } from "@/features/alerts/components/alerts-view";

export const metadata: Metadata = { title: "Alertas · Leilão Tracker" };

export default function AlertsPage({ searchParams }: PageProps<"/alertas">) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Alertas"
        description="Lotes novos que combinaram com os seus monitores. Os dados do lote são os da última coleta."
        actions={
          <ButtonLink href="/monitores" variant="secondary">
            Monitores
          </ButtonLink>
        }
      />
      <Suspense fallback={<AlertsViewSkeleton />}>
        <AlertsView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
