import { Target } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui";

import { getDashboardSummary } from "../queries";
import type { DashboardSummary as Summary } from "../types";

const METRICS = [
  { key: "activeAuctions", label: "Leilões cadastrados", hint: "Não arquivados" },
  { key: "activeLots", label: "Lotes cadastrados", hint: "Não arquivados" },
  { key: "followedLotsWithoutResult", label: "Lotes acompanhados", hint: "Ainda sem resultado" },
  { key: "analyzedLots", label: "Lotes analisados", hint: "Com análise fixada" },
] as const satisfies readonly { key: Exclude<keyof Summary, "indicator">; label: string; hint: string }[];

const GRID = "grid gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4";

export async function DashboardSummary() {
  const summary = await getDashboardSummary();

  return (
    <div className="grid gap-6">
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
      <LimitIndicator indicator={summary.indicator} />
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

/** "X de Y resultados comparáveis ficaram dentro do limite" (SPEC §10), sempre com o denominador. */
function LimitIndicator({ indicator }: { indicator: Summary["indicator"] }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Target aria-hidden="true" className="size-4" />
          Decisões anteriores ao resultado
        </CardDescription>
        <CardTitle>
          {indicator.comparable === 0
            ? "Ainda sem resultados comparáveis"
            : `${indicator.withinLimit} de ${indicator.comparable} resultados comparáveis ficaram dentro do limite`}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-caption text-muted">
        Considera lotes ativos arrematados, com preço final conhecido e análise fixada antes do desfecho. Estar dentro
        do limite não significa que seria possível arrematar por esse preço.
      </CardContent>
    </Card>
  );
}
