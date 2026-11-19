import { ArrowUpRight, Calculator, CalendarClock, CircleAlert, ClipboardList, Eye, Target } from "lucide-react";
import Link from "next/link";

import { cardVariants, Skeleton } from "@/components/ui";
import { getRegionOverview } from "@/features/listings/queries";
import { catalogAuctionPath } from "@/features/listings/search";
import { getFollowedLotsOverview } from "@/features/lots/queries";
import { formatRatio, formatShortDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { getLimitIndicator, getPendingItems } from "../queries";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const linkClass =
  "inline-flex items-center gap-1.5 text-foreground-secondary underline-offset-4 hover:text-foreground hover:underline";

/**
 * Linha abaixo do título (DESIGN.md §15.1, D-44): contagens que levam à ação, cada uma com link para o bloco. As
 * consultas têm memo por requisição: os blocos abaixo leem o mesmo resultado.
 */
export async function DashboardCounts() {
  const [region, followed, pending] = await Promise.all([
    getRegionOverview(),
    getFollowedLotsOverview(),
    getPendingItems(),
  ]);
  const [nextAuction] = region.auctions;
  const pendingCount = pending.drafts.length + pending.awaitingResult.length;

  const parts = [
    <a key="to-analyze" href="#to-analyze" className={linkClass}>
      <Calculator aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
      <span>{region.toAnalyzeTotal} para analisar</span>
    </a>,
    nextAuction ? (
      <Link key="next-auction" href={catalogAuctionPath(nextAuction)} className={linkClass}>
        <CalendarClock aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
        <span>
          próximo leilão na região: {nextAuction.date ? formatShortDateTime(nextAuction.date) : "data não informada"},{" "}
          {plural(nextAuction.matching, "lote", "lotes")}
        </span>
        <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
      </Link>
    ) : null,
    <a key="followed" href="#followed-lots" className={linkClass}>
      <Eye aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
      <span>{plural(followed.items.length, "acompanhado", "acompanhados")}</span>
      {followed.aboveLimit > 0 ? (
        <span className="inline-flex items-center gap-1 font-medium text-error">
          , <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          {followed.aboveLimit} com provável acima do limite
        </span>
      ) : null}
    </a>,
    pendingCount > 0 ? (
      <a key="pending" href="#pending-items" className={linkClass}>
        <ClipboardList aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
        <span>{plural(pendingCount, "pendência", "pendências")}</span>
      </a>
    ) : null,
  ].filter((part) => part !== null);

  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 tabular-nums">
      {parts.map((part, index) => (
        <span key={part.key} className="inline-flex items-center gap-x-2.5">
          {index > 0 ? (
            <span aria-hidden="true" className="text-border-strong">
              ·
            </span>
          ) : null}
          {part}
        </span>
      ))}
    </span>
  );
}

export function DashboardCountsSkeleton() {
  return (
    <span className="inline-block h-4 w-md max-w-full animate-pulse rounded-md bg-border/70 motion-reduce:animate-none" />
  );
}

/** "X de Y resultados comparáveis ficaram dentro do limite" (SPEC §10), sempre com o denominador. */
export async function DecisionIndicator() {
  const indicator = await getLimitIndicator();
  const ratio = indicator.comparable > 0 ? indicator.withinLimit / indicator.comparable : 0;
  return (
    <section aria-labelledby="decision-indicator" className={cn(cardVariants(), "grid gap-3 p-5 md:p-6")}>
      <h2 id="decision-indicator" className="flex items-center gap-2 text-heading-3 text-foreground">
        <Target aria-hidden="true" className="size-4 shrink-0 text-muted" />
        Suas decisões antes do resultado
      </h2>
      {indicator.comparable === 0 ? (
        <p className="text-body text-foreground-secondary">Ainda sem resultados comparáveis.</p>
      ) : (
        <div className="grid gap-2.5">
          <p className="grid gap-1 text-body text-foreground-secondary">
            <span className="text-heading-1 text-foreground tabular-nums">
              {indicator.withinLimit} <span className="font-medium text-muted-subtle">de {indicator.comparable}</span>
            </span>{" "}
            resultados comparáveis ficaram dentro do limite
          </p>
          <div className="grid gap-1" aria-hidden="true">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-subtle">
              <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.round(ratio * 100)}%` }} />
            </div>
            <span className="text-right text-caption font-medium text-muted tabular-nums">
              {formatRatio(ratio)} dentro do limite
            </span>
          </div>
        </div>
      )}
      <p className="border-t border-border pt-3 text-caption text-muted">
        Arrematados com preço final e análise fixada antes do desfecho.
      </p>
    </section>
  );
}

export function DecisionIndicatorSkeleton() {
  return <Skeleton className="h-48" aria-hidden="true" />;
}
