import { cardVariants, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

import { getDashboardCounts, getLimitIndicator } from "../queries";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Resumo em uma linha abaixo do título (DESIGN.md §15.1): leilões, lotes, acompanhados e analisados. */
export async function DashboardCounts() {
  const counts = await getDashboardCounts();
  const parts = [
    plural(counts.activeAuctions, "leilão", "leilões"),
    plural(counts.activeLots, "lote", "lotes"),
    plural(counts.followedLotsWithoutResult, "acompanhado", "acompanhados"),
    `${counts.analyzedLots} com análise fixada`,
  ];
  return <span className="tabular-nums">{parts.join(" · ")}</span>;
}

export function DashboardCountsSkeleton() {
  return (
    <span className="inline-block h-4 w-72 max-w-full animate-pulse rounded-md bg-border/70 motion-reduce:animate-none" />
  );
}

/** "X de Y resultados comparáveis ficaram dentro do limite" (SPEC §10), sempre com o denominador. */
export async function DecisionIndicator() {
  const indicator = await getLimitIndicator();
  return (
    <section aria-labelledby="decision-indicator" className={cn(cardVariants(), "grid gap-3 p-5 md:p-6")}>
      <h2 id="decision-indicator" className="text-heading-3 text-foreground">
        Suas decisões antes do resultado
      </h2>
      {indicator.comparable === 0 ? (
        <p className="text-body text-foreground-secondary">Ainda sem resultados comparáveis.</p>
      ) : (
        <p className="grid gap-1 text-body text-foreground-secondary">
          <span className="text-display text-foreground tabular-nums">
            {indicator.withinLimit} <span className="font-medium text-muted-subtle">de {indicator.comparable}</span>
          </span>{" "}
          resultados comparáveis ficaram dentro do limite
        </p>
      )}
      <p className="border-t border-border pt-3 text-caption text-muted">
        Considera lotes ativos arrematados, com preço final conhecido e análise fixada antes do desfecho. Estar dentro
        do limite não significa que seria possível arrematar por esse preço.
      </p>
    </section>
  );
}

export function DecisionIndicatorSkeleton() {
  return <Skeleton className="h-48" aria-hidden="true" />;
}
