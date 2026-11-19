import { BellRing, ChevronRight } from "lucide-react";
import Link from "next/link";

import { ButtonLink, cardVariants } from "@/components/ui";
import { cn } from "@/lib/utils";

import { listRecentUnreadAlerts } from "../queries";

const LIMIT = 3;

/**
 * Alertas não lidos no dashboard, numa faixa: quantos são e os títulos dos mais recentes. Os cartões completos ficam
 * em Alertas. Sem nenhum, a faixa some. Renderizar dentro de <Suspense>.
 */
export async function RecentAlerts() {
  const { items, total } = await listRecentUnreadAlerts(LIMIT);
  if (total === 0) return null;

  return (
    <section
      aria-labelledby="recent-alerts"
      className={cn(
        cardVariants({ variant: "summary" }),
        "flex flex-wrap items-center gap-x-5 gap-y-2 border-l-2 border-l-accent px-5 py-4",
      )}
    >
      <h2 id="recent-alerts" className="flex items-center gap-2.5 text-body font-semibold text-foreground">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent">
          <BellRing aria-hidden="true" className="size-4" />
        </span>
        {total === 1 ? "1 alerta não lido" : `${total} alertas não lidos`}
      </h2>
      <ul className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1 text-caption text-muted">
        {items.map((alert, index) => (
          <li key={alert.id} className="flex min-w-0 items-center gap-2">
            {index > 0 ? <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-border-strong" /> : null}
            {alert.listing.trackedLotId ? (
              <Link
                href={`/lotes/${alert.listing.trackedLotId}`}
                className="min-w-0 truncate hover:text-foreground hover:underline"
              >
                {alert.listing.title}
              </Link>
            ) : (
              <span className="min-w-0 truncate">{alert.listing.title}</span>
            )}
          </li>
        ))}
      </ul>
      <ButtonLink href="/alertas" variant="secondary" size="sm">
        Ver alertas
        <ChevronRight aria-hidden="true" />
      </ButtonLink>
    </section>
  );
}
