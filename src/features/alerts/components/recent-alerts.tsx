import { AlertTriangle, BellRing, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Badge, ButtonLink, cardVariants } from "@/components/ui";
import { getCollectorStatus } from "@/features/listings/queries";
import { cn } from "@/lib/utils";

import { listRecentUnreadAlerts } from "../queries";

const LIMIT = 3;

function collectorWarningOf(collector: Awaited<ReturnType<typeof getCollectorStatus>>) {
  if (collector.health === "failed") {
    return {
      variant: "destructive" as const,
      label:
        collector.failingSources.length > 0 ? `Coleta falhou: ${collector.failingSources.join(", ")}` : "Coleta falhou",
    };
  }
  if (collector.health === "late") {
    return { variant: "warning" as const, label: "Coleta atrasada" };
  }
  if (collector.health === "ok" && collector.failedListings > 0) {
    return {
      variant: "warning" as const,
      label:
        collector.failedListings === 1
          ? "1 lote com falha na coleta"
          : `${collector.failedListings} lotes com falha na coleta`,
    };
  }
  return null;
}

/**
 * Notificações no dashboard: alertas não lidos e avisos de falha/atraso da coleta (D-37).
 * Sem nenhum alerta nem aviso, a faixa some. Renderizar dentro de <Suspense>.
 */
export async function RecentAlerts() {
  const [{ items, total }, collector] = await Promise.all([listRecentUnreadAlerts(LIMIT), getCollectorStatus()]);
  const collectorWarning = collectorWarningOf(collector);
  if (total === 0 && collectorWarning === null) return null;

  const isOnlyDestructiveWarning = total === 0 && collectorWarning?.variant === "destructive";

  return (
    <section
      className={cn(
        cardVariants({ variant: "summary" }),
        "flex flex-wrap items-center gap-x-5 gap-y-2 border-l-2 px-5 py-4",
        isOnlyDestructiveWarning ? "border-l-error" : "border-l-accent",
      )}
    >
      <h2 id="recent-alerts" className="flex items-center gap-2.5 text-body font-semibold text-foreground">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            isOnlyDestructiveWarning ? "bg-error-subtle text-error" : "bg-accent-subtle text-accent",
          )}
        >
          {isOnlyDestructiveWarning ? (
            <AlertTriangle aria-hidden="true" className="size-4" />
          ) : (
            <BellRing aria-hidden="true" className="size-4" />
          )}
        </span>
        {total === 0 ? "Notificações da coleta" : total === 1 ? "1 alerta não lido" : `${total} alertas não lidos`}
      </h2>

      {items.length > 0 ? (
        <ul role="list" className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1 text-caption text-muted">
          {items.map((alert, index) => (
            <li key={alert.id} className="flex min-w-0 items-center gap-2">
              {index > 0 ? <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-border-strong" /> : null}
              {alert.listing.trackedLotId ? (
                <Link
                  href={`/lotes/${alert.listing.trackedLotId}`}
                  title={alert.listing.title}
                  className="min-w-0 truncate rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent"
                >
                  {alert.listing.title}
                </Link>
              ) : (
                <span className="min-w-0 truncate" title={alert.listing.title}>
                  {alert.listing.title}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="min-w-0 flex-1" />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {collectorWarning ? <Badge variant={collectorWarning.variant}>{collectorWarning.label}</Badge> : null}
        {total > 0 ? (
          <ButtonLink href="/alertas" variant="secondary" size="sm">
            Ver alertas
            <ChevronRight aria-hidden="true" />
          </ButtonLink>
        ) : null}
      </div>
    </section>
  );
}
