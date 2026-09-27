import { Gavel } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Skeleton } from "@/components/ui";

import { getDashboardSummary } from "../queries";
import type { DashboardSummary as Summary } from "../types";

const METRICS = [
  { key: "activeAuctions", label: "Leilões cadastrados", hint: "Não arquivados" },
  { key: "activeLots", label: "Lotes cadastrados", hint: "Não arquivados" },
  { key: "followedLotsWithoutResult", label: "Lotes acompanhados", hint: "Ainda sem resultado" },
  { key: "analyzedLots", label: "Lotes analisados", hint: "Com análise fixada" },
] as const satisfies readonly { key: keyof Summary; label: string; hint: string }[];

const GRID = "grid gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4";

export async function DashboardSummary() {
  const summary = await getDashboardSummary();

  return (
    <div className="grid gap-10 lg:gap-12">
      <section aria-label="Resumo" className={GRID}>
        {METRICS.map(({ key, label, hint }) => (
          <Card key={key}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-display tabular-nums">{summary[key]}</CardTitle>
            </CardHeader>
            <CardContent className="text-caption text-muted">{hint}</CardContent>
          </Card>
        ))}
      </section>
      {summary.activeAuctions === 0 ? (
        <EmptyState
          icon={Gavel}
          title="Nenhum leilão cadastrado"
          description="Cadastre o primeiro leilão para começar a acompanhar lotes e registrar análises."
        />
      ) : null}
    </div>
  );
}

export function DashboardSummarySkeleton() {
  return (
    <div className={GRID} aria-hidden="true">
      {METRICS.map(({ key }) => (
        <Skeleton key={key} className="h-32" />
      ))}
    </div>
  );
}
