import { Radar } from "lucide-react";

import { Badge, Skeleton } from "@/components/ui";
import type { CollectorHealth } from "@/domain/listings/health";
import { formatCompactDateTime, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { getCollectorStatus } from "../queries";

const HEALTH_BADGES = {
  never: { label: "Nenhuma coleta ainda", variant: "outline" },
  running: { label: "Coleta em andamento", variant: "default" },
  ok: null,
  late: { label: "Coleta atrasada", variant: "warning" },
  failed: { label: "Coleta falhou", variant: "destructive" },
} as const satisfies Record<
  CollectorHealth,
  { label: string; variant: "outline" | "default" | "warning" | "destructive" } | null
>;

/**
 * Saúde da coleta automática: última execução de cada fonte, atraso do agendamento e veículos abertos na região.
 * No modo `compact` (Dashboard), omite badges de falha — que vão para as notificações — e comprime a data.
 * Lê a sessão: renderizar dentro de <Suspense>.
 */
export async function CollectorStatusLine({ compact = false }: { compact?: boolean }) {
  const { health, lastFinishedAt, failingSources, failedListings, openInRegion, regionLabel, radiusKm } =
    await getCollectorStatus();
  const badge = compact ? null : HEALTH_BADGES[health];

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
          <span className="tabular-nums">
            {compact
              ? `Coleta ${formatCompactDateTime(lastFinishedAt)}`
              : `Última coleta em ${formatDateTime(lastFinishedAt)}`}
          </span>
        </>
      ) : null}
      {badge ? (
        <Badge variant={badge.variant}>
          {health === "failed" && failingSources.length > 0
            ? `${badge.label}: ${failingSources.join(", ")}`
            : badge.label}
        </Badge>
      ) : null}
      {!compact && health === "ok" && failedListings > 0 ? (
        <Badge variant="warning">
          {failedListings === 1 ? "1 lote com falha" : `${failedListings} lotes com falha`}
        </Badge>
      ) : null}
    </div>
  );
}

export function CollectorStatusLineSkeleton({ compact = false }: { compact?: boolean }) {
  return <Skeleton className={cn("max-w-full", compact ? "h-4 w-72" : "h-5 w-96")} aria-hidden="true" />;
}
