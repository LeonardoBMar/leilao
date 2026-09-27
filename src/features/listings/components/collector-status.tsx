import { Radar } from "lucide-react";

import { Badge, Skeleton } from "@/components/ui";
import type { CollectorHealth } from "@/domain/listings/health";
import { formatDateTime } from "@/lib/format";

import { getCollectorStatus } from "../queries";

const HEALTH_BADGES = {
  never: { label: "Nenhuma coleta ainda", variant: "outline" },
  running: { label: "Coleta em andamento", variant: "default" },
  ok: null,
  late: { label: "Coleta atrasada", variant: "warning" },
  failed: { label: "Última coleta falhou", variant: "destructive" },
} as const satisfies Record<
  CollectorHealth,
  { label: string; variant: "outline" | "default" | "warning" | "destructive" } | null
>;

/**
 * Saúde da coleta automática: última execução, atraso do agendamento e lotes abertos na região. Falha fica visível
 * no app, não só no GitHub (docs/PLANO-COLETA.md, etapa 1). Lê a sessão: renderizar dentro de <Suspense>.
 */
export async function CollectorStatusLine() {
  const { health, lastRun, openInRegion, regionLabel, radiusKm } = await getCollectorStatus();
  const badge = HEALTH_BADGES[health];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-foreground-secondary">
      <Radar aria-hidden="true" className="size-4 shrink-0 text-muted" />
      <span>
        <strong className="text-foreground tabular-nums">{openInRegion}</strong> lotes abertos até {radiusKm} km de{" "}
        {regionLabel}
      </span>
      {lastRun ? (
        <>
          <span aria-hidden="true">·</span>
          <span>
            Última coleta ({lastRun.sourceName}) em {formatDateTime(lastRun.finishedAt ?? lastRun.startedAt)}
          </span>
        </>
      ) : null}
      {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
      {health === "ok" && lastRun && lastRun.failed > 0 ? (
        <Badge variant="warning">{lastRun.failed} lotes com falha</Badge>
      ) : null}
    </div>
  );
}

export function CollectorStatusLineSkeleton() {
  return <Skeleton className="h-5 w-96 max-w-full" aria-hidden="true" />;
}
