import { Radar } from "lucide-react";
import Link from "next/link";

import { Badge, Skeleton } from "@/components/ui";
import { formatCompactDateTime, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { getCollectorStatus } from "../queries";

/**
 * Resumo operacional da coleta: veículos abertos na região e horário da última execução.
 * Falhas e atrasos de coleta ficam concentrados na central de notificações do header e em `/sistema`.
 * Lê a sessão: renderizar dentro de <Suspense>.
 */
export async function CollectorStatusLine({ compact = false }: { compact?: boolean }) {
  const { health, lastFinishedAt, openInRegion, regionLabel, radiusKm } = await getCollectorStatus();
  const neutralBadge = compact
    ? null
    : health === "running"
      ? ({ label: "Coleta em andamento", variant: "default" } as const)
      : health === "never"
        ? ({ label: "Nenhuma coleta ainda", variant: "outline" } as const)
        : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-y-1 text-caption",
        compact ? "gap-x-2 text-muted" : "gap-x-3 text-foreground-secondary",
      )}
    >
      <Radar
        aria-hidden="true"
        className={cn("shrink-0", compact ? "size-3.5 text-muted-subtle" : "size-4 text-muted")}
      />
      <span>
        <strong className={cn("tabular-nums", compact ? "font-medium text-foreground-secondary" : "text-foreground")}>
          {openInRegion}
        </strong>{" "}
        veículos abertos até {radiusKm} km de {regionLabel}
      </span>
      {lastFinishedAt ? (
        <>
          <span aria-hidden="true">·</span>
          <Link
            href="/sistema"
            className="rounded-sm tabular-nums outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent"
          >
            {compact
              ? `Coleta ${formatCompactDateTime(lastFinishedAt)}`
              : `Última coleta em ${formatDateTime(lastFinishedAt)}`}
          </Link>
        </>
      ) : null}
      {neutralBadge ? <Badge variant={neutralBadge.variant}>{neutralBadge.label}</Badge> : null}
    </div>
  );
}

export function CollectorStatusLineSkeleton({ compact = false }: { compact?: boolean }) {
  return <Skeleton className={cn("max-w-full", compact ? "h-4 w-72" : "h-5 w-96")} aria-hidden="true" />;
}
