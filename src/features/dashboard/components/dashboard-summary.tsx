import {
  ArrowDown,
  ArrowUpRight,
  Calculator,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Eye,
  Target,
} from "lucide-react";
import Link from "next/link";

import { cardVariants, Skeleton } from "@/components/ui";
import { getRegionOverview } from "@/features/listings/queries";
import { catalogAuctionPath } from "@/features/listings/search";
import { getFollowedLotsOverview } from "@/features/lots/queries";
import { formatCompactDateTime, formatRatio } from "@/lib/format";
import { cn } from "@/lib/utils";

import { getLimitIndicator, getPendingItems } from "../queries";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const kpiCellClass = "flex h-full flex-col justify-between gap-2 bg-surface p-4";
const kpiLinkClass = cn(
  kpiCellClass,
  "group transition-colors duration-120 hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset",
);

/**
 * Faixa de KPIs operacionais no topo do dashboard (DESIGN.md §4.2, §19.2, D-44): contagens que levam à ação, cada
 * uma ligada ao bloco ou à página correspondente. As consultas têm memo por requisição.
 */
export async function DashboardKpis() {
  const [region, followed, pending] = await Promise.all([
    getRegionOverview(),
    getFollowedLotsOverview(),
    getPendingItems(),
  ]);
  const [nextAuction] = region.auctions;
  const pendingTotal = pending.draftsTotal + pending.awaitingResultTotal;
  const followedTotal = followed.items.length;

  const pendingNote =
    pendingTotal === 0 ? (
      <span className="inline-flex items-center gap-1 text-muted">
        <CircleCheck aria-hidden="true" className="size-3.5 shrink-0 text-success" />
        Tudo em dia
      </span>
    ) : pending.awaitingResultTotal > 0 && pending.draftsTotal > 0 ? (
      `${plural(pending.awaitingResultTotal, "resultado", "resultados")} · ${plural(pending.draftsTotal, "rascunho", "rascunhos")}`
    ) : pending.awaitingResultTotal > 0 ? (
      `${plural(pending.awaitingResultTotal, "resultado", "resultados")} a registrar`
    ) : (
      `${plural(pending.draftsTotal, "rascunho", "rascunhos")} em aberto`
    );

  return (
    <section aria-label="Resumo operacional">
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
        <li>
          <a href="#to-analyze" className={kpiLinkClass}>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-label text-foreground-secondary">
                <Calculator aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
                Para analisar
              </span>
              <ArrowDown
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-subtle transition-transform duration-120 group-hover:translate-y-0.5 group-hover:text-foreground"
              />
            </div>
            <p className="text-heading-2 font-semibold text-foreground tabular-nums">{region.toAnalyzeTotal}</p>
            <p className="text-caption text-muted tabular-nums">
              {region.toAnalyzeTotal === 0 ? (
                "Nenhum cabe no limite"
              ) : region.toAnalyzeComfortable > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-success">
                  <CircleCheck aria-hidden="true" className="size-3.5 shrink-0" />
                  {plural(region.toAnalyzeComfortable, "cabe com folga", "cabem com folga")}
                </span>
              ) : (
                "No limite estimado"
              )}
            </p>
          </a>
        </li>

        <li>
          <a href="#followed-lots" className={kpiLinkClass}>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-label text-foreground-secondary">
                <Eye aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
                Acompanhados
              </span>
              <ArrowDown
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-subtle transition-transform duration-120 group-hover:translate-y-0.5 group-hover:text-foreground"
              />
            </div>
            <p className="text-heading-2 font-semibold text-foreground tabular-nums">{followedTotal}</p>
            <p className="text-caption text-muted tabular-nums">
              {followedTotal === 0 ? (
                "Nenhum lote ativo"
              ) : followed.aboveLimit > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-error">
                  <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                  {followed.aboveLimit} provável acima
                </span>
              ) : (
                "Nenhum com provável acima"
              )}
            </p>
          </a>
        </li>

        <li>
          {pendingTotal > 0 ? (
            <a href="#pending-items" className={kpiLinkClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-label text-foreground-secondary">
                  <ClipboardList aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
                  Pendências
                </span>
                <ArrowDown
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-subtle transition-transform duration-120 group-hover:translate-y-0.5 group-hover:text-foreground"
                />
              </div>
              <p className="text-heading-2 font-semibold text-foreground tabular-nums">{pendingTotal}</p>
              <p className="text-caption text-muted tabular-nums">{pendingNote}</p>
            </a>
          ) : (
            <div className={kpiCellClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-label text-foreground-secondary">
                  <ClipboardList aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
                  Pendências
                </span>
              </div>
              <p className="text-heading-2 font-semibold text-muted tabular-nums">0</p>
              <p className="text-caption text-muted tabular-nums">{pendingNote}</p>
            </div>
          )}
        </li>

        <li>
          {nextAuction ? (
            <Link href={catalogAuctionPath(nextAuction)} className={kpiLinkClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-label text-foreground-secondary">
                  <CalendarClock aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
                  Próximo leilão
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-subtle transition-transform duration-120 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                />
              </div>
              <p className="text-heading-2 font-semibold text-foreground tabular-nums">
                {nextAuction.date ? formatCompactDateTime(nextAuction.date) : "Sem data"}
              </p>
              <p className="truncate text-caption text-muted tabular-nums">
                {plural(nextAuction.matching, "lote", "lotes")} · {nextAuction.sourceName}
              </p>
            </Link>
          ) : (
            <a href="#region-auctions" className={kpiLinkClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-label text-foreground-secondary">
                  <CalendarClock aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
                  Próximo leilão
                </span>
                <ArrowDown
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-subtle transition-transform duration-120 group-hover:translate-y-0.5 group-hover:text-foreground"
                />
              </div>
              <p className="text-heading-2 font-semibold text-muted tabular-nums">—</p>
              <p className="truncate text-caption text-muted">Nenhum nos próximos 7 dias</p>
            </a>
          )}
        </li>
      </ul>
    </section>
  );
}

export function DashboardKpisSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4"
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((slot) => (
        <div key={slot} className="grid gap-2.5 bg-surface p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
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
