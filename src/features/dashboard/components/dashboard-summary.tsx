import {
  ArrowDown,
  ArrowUpRight,
  Calculator,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Eye,
  Target,
} from "lucide-react";
import Link from "next/link";

import { ButtonLink, cardVariants, Skeleton } from "@/components/ui";
import { getRegionOverview } from "@/features/listings/queries";
import { getFollowedLotsOverview } from "@/features/lots/queries";
import { catalogAuctionPath } from "@/lib/catalog-search";
import { formatCompactDateTime, formatRatio } from "@/lib/format";
import { cn } from "@/lib/utils";

import { getLimitIndicator, getPendingItems } from "../queries";

const ptBrPlural = new Intl.PluralRules("pt-BR");
const plural = (count: number, one: string, many: string) =>
  `${count} ${ptBrPlural.select(count) === "one" ? one : many}`;

const kpiCellClass = "flex h-full flex-col justify-between gap-2 bg-surface p-4";
const kpiLinkClass = cn(
  kpiCellClass,
  "group transition-colors duration-150 ease-[var(--ease-out)] hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent focus-visible:ring-inset active:bg-surface-subtle motion-reduce:transition-none",
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
      followedTotal === 0 ? (
        "Sem pendências"
      ) : (
        <span className="inline-flex items-center gap-1 text-muted">
          <CircleCheck aria-hidden="true" className="size-3.5 shrink-0 text-success" />
          Tudo em dia
        </span>
      )
    ) : pending.awaitingResultTotal > 0 && pending.draftsTotal > 0 ? (
      `${plural(pending.awaitingResultTotal, "resultado", "resultados")} a registrar · ${plural(pending.draftsTotal, "rascunho", "rascunhos")} em aberto`
    ) : pending.awaitingResultTotal > 0 ? (
      `${plural(pending.awaitingResultTotal, "resultado", "resultados")} a registrar`
    ) : (
      `${plural(pending.draftsTotal, "rascunho", "rascunhos")} em aberto`
    );

  return (
    <div className="@container">
      <ul
        role="list"
        aria-label="Resumo operacional"
        className="grid grid-cols-2 gap-px overflow-clip rounded-lg border border-border bg-border @3xl:grid-cols-4"
      >
        <li>
          <a href="#to-analyze" className={kpiLinkClass}>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-label text-foreground-secondary">
                <Calculator aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
                Para analisar
                <span className="sr-only"> — ir para a seção abaixo</span>
              </span>
              <ArrowDown
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-subtle transition-[transform,color] duration-150 ease-[var(--ease-out)] group-hover:translate-y-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
              />
            </div>
            <p
              className={cn(
                "text-heading-2 font-semibold tabular-nums",
                region.toAnalyzeTotal === 0 ? "text-muted" : "text-foreground",
              )}
            >
              {region.toAnalyzeTotal}
            </p>
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
          <a
            href="#followed-lots"
            className={cn(kpiLinkClass, followed.aboveLimit > 0 && "bg-error-subtle/40 hover:bg-error-subtle/60")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-label text-foreground-secondary">
                <Eye aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
                Acompanhados
                <span className="sr-only"> — ir para a seção abaixo</span>
              </span>
              <ArrowDown
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-subtle transition-[transform,color] duration-150 ease-[var(--ease-out)] group-hover:translate-y-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
              />
            </div>
            <p
              className={cn(
                "text-heading-2 font-semibold tabular-nums",
                followedTotal === 0 ? "text-muted" : "text-foreground",
              )}
            >
              {followedTotal}
            </p>
            <p className="text-caption text-muted tabular-nums">
              {followedTotal === 0 ? (
                "Nenhum lote ativo"
              ) : followed.aboveLimit > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-error">
                  <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                  {followed.aboveLimit} com provável acima do limite
                </span>
              ) : (
                "Todos dentro do limite estimado"
              )}
            </p>
          </a>
        </li>

        <li>
          {pendingTotal > 0 ? (
            <a href="#pending-items" className={cn(kpiLinkClass, "bg-warning-subtle/40 hover:bg-warning-subtle/60")}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-label text-foreground-secondary">
                  <ClipboardList aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
                  Pendências
                  <span className="sr-only"> — ir para a seção abaixo</span>
                </span>
                <ArrowDown
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-subtle transition-[transform,color] duration-150 ease-[var(--ease-out)] group-hover:translate-y-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
                />
              </div>
              <p className="text-heading-2 font-semibold text-foreground tabular-nums">{pendingTotal}</p>
              <p className="text-caption text-muted tabular-nums">{pendingNote}</p>
            </a>
          ) : (
            <Link href="/minhas-analises" className={kpiLinkClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-label text-foreground-secondary">
                  <ClipboardList aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
                  Pendências
                  <span className="sr-only"> — abrir Minhas análises</span>
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-subtle transition-[transform,color] duration-150 ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
                />
              </div>
              <p className="text-heading-2 font-semibold text-muted tabular-nums">0</p>
              <p className="text-caption text-muted tabular-nums">{pendingNote}</p>
            </Link>
          )}
        </li>

        <li>
          {nextAuction ? (
            <Link href={catalogAuctionPath(nextAuction)} className={kpiLinkClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-label text-foreground-secondary">
                  <CalendarClock aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
                  Próximo no catálogo
                  <span className="sr-only"> — abrir página do leilão</span>
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-subtle transition-[transform,color] duration-150 ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
                />
              </div>
              <p
                title={nextAuction.date ? formatCompactDateTime(nextAuction.date) : undefined}
                className="truncate text-body-lg font-semibold whitespace-nowrap text-foreground tabular-nums sm:text-heading-2"
              >
                {nextAuction.date ? (
                  <time dateTime={nextAuction.date.toISOString()}>{formatCompactDateTime(nextAuction.date)}</time>
                ) : (
                  "Sem data"
                )}
              </p>
              <p
                title={`${plural(nextAuction.matching, "lote", "lotes")} · ${nextAuction.sourceName}`}
                className="line-clamp-1 text-caption text-muted tabular-nums"
              >
                {plural(nextAuction.matching, "lote", "lotes")} · {nextAuction.sourceName}
              </p>
            </Link>
          ) : (
            <a href="#region-auctions" className={kpiLinkClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-label text-foreground-secondary">
                  <CalendarClock aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
                  Próximo no catálogo
                  <span className="sr-only"> — ir para a seção abaixo</span>
                </span>
                <ArrowDown
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-subtle transition-[transform,color] duration-150 ease-[var(--ease-out)] group-hover:translate-y-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
                />
              </div>
              <p className="text-heading-2 font-semibold text-muted tabular-nums">—</p>
              <p className="text-caption text-muted">Nenhum nos próximos 7 dias</p>
            </a>
          )}
        </li>
      </ul>
    </div>
  );
}

const KPI_SKELETON_ITEMS = [
  { label: "Para analisar", icon: Calculator, valueWidth: "w-12", noteWidth: "w-32" },
  { label: "Acompanhados", icon: Eye, valueWidth: "w-10", noteWidth: "w-36" },
  { label: "Pendências", icon: ClipboardList, valueWidth: "w-10", noteWidth: "w-28" },
  { label: "Próximo no catálogo", icon: CalendarClock, valueWidth: "w-28", noteWidth: "w-36" },
] as const;

export function DashboardKpisSkeleton() {
  return (
    <div className="@container" aria-hidden="true">
      <ul className="grid grid-cols-2 gap-px overflow-clip rounded-lg border border-border bg-border @3xl:grid-cols-4">
        {KPI_SKELETON_ITEMS.map(({ label, icon: Icon, valueWidth, noteWidth }) => (
          <li key={label} className={kpiCellClass}>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-label text-foreground-secondary">
                <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-subtle" />
                {label}
              </span>
              <Skeleton className="size-3.5 rounded-sm" />
            </div>
            <div className="flex h-7 items-center">
              <Skeleton className={cn("h-6", valueWidth)} />
            </div>
            <div className="flex h-4 items-center">
              <Skeleton className={cn("h-3.5", noteWidth)} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "X de Y resultados comparáveis ficaram dentro do limite" (SPEC §10), sempre com o denominador. */
export async function DecisionIndicator() {
  const indicator = await getLimitIndicator();
  const ratio = indicator.comparable > 0 ? indicator.withinLimit / indicator.comparable : 0;
  return (
    <section className={cn(cardVariants(), "grid gap-3 p-5 md:p-6")}>
      <h2 id="decision-indicator" className="flex items-center gap-2 text-heading-3 text-foreground">
        <Target aria-hidden="true" className="size-4 shrink-0 text-muted" />
        Suas decisões antes do resultado
      </h2>
      {indicator.comparable === 0 ? (
        <div className="grid gap-3">
          <p className="text-body text-foreground-secondary">
            Ainda sem resultados comparáveis. Fixe uma análise antes do leilão e registre o lance final para acompanhar
            sua calibração.
          </p>
          <ButtonLink href="/mercado/calibracao" variant="secondary" size="sm" className="w-fit">
            Ver calibração
            <ChevronRight aria-hidden="true" />
          </ButtonLink>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="grid gap-1 text-body text-foreground-secondary">
            <span className="text-heading-1 text-foreground tabular-nums">
              {indicator.withinLimit} <span className="font-medium text-muted">de {indicator.comparable}</span>
            </span>{" "}
            resultados comparáveis ficaram dentro do limite
          </p>
          <div className="grid gap-1">
            <div className="h-1.5 w-full overflow-clip rounded-full bg-primary-subtle" aria-hidden="true">
              <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.round(ratio * 100)}%` }} />
            </div>
            <span className="text-end text-caption font-medium text-muted tabular-nums">
              {formatRatio(ratio)} dentro do limite
            </span>
          </div>
          <ButtonLink href="/mercado/calibracao" variant="secondary" size="sm" className="w-fit">
            Ver calibração
            <ChevronRight aria-hidden="true" />
          </ButtonLink>
        </div>
      )}
    </section>
  );
}

export function DecisionIndicatorSkeleton() {
  return <Skeleton className="h-36" aria-hidden="true" />;
}
