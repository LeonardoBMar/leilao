import { BellRing, ChevronRight } from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "@/components/ui";

import { listRecentUnreadAlerts } from "../queries";

const LIMIT = 3;

/**
 * Faixa de alertas não lidos no dashboard (D-85).
 * Sem alertas não lidos, a faixa some. Avisos de falha de coleta ficam nas notificações do header.
 * Renderizar dentro de <Suspense>.
 */
export async function RecentAlerts() {
  const { items, total } = await listRecentUnreadAlerts(LIMIT);
  if (total === 0) return null;

  return (
    <section
      aria-labelledby="recent-alerts"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-surface-subtle px-4 py-3"
    >
      <h2 id="recent-alerts" className="flex items-center gap-2.5 text-body font-semibold text-foreground">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent">
          <BellRing aria-hidden="true" className="size-4" />
        </span>
        {total === 1 ? "1 alerta não lido" : `${total} alertas não lidos`}
      </h2>

      <ul role="list" className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1 text-caption text-muted">
        {items.map((alert, index) => (
          <li key={alert.id} className="flex min-w-0 items-center gap-2">
            {index > 0 ? <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-border-strong" /> : null}
            {alert.trackedLotId ? (
              <Link
                href={`/lotes/${alert.trackedLotId}`}
                className="inline-flex min-h-10 min-w-0 items-center rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:outline-transparent"
              >
                <span className="line-clamp-1" title={alert.title}>
                  {alert.title}
                </span>
              </Link>
            ) : (
              <span className="line-clamp-1 min-w-0" title={alert.title}>
                {alert.title}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href="/alertas" variant="secondary" size="sm">
          Ver alertas
          <ChevronRight aria-hidden="true" />
        </ButtonLink>
      </div>
    </section>
  );
}
