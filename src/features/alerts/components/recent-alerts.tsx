import { BellRing } from "lucide-react";
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
      className={cn(cardVariants({ variant: "summary" }), "flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4")}
    >
      <h2 id="recent-alerts" className="flex items-center gap-2 text-body font-semibold text-foreground">
        <BellRing aria-hidden="true" className="size-4 text-accent" />
        {total === 1 ? "1 alerta não lido" : `${total} alertas não lidos`}
      </h2>
      <ul className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
        {items.map((alert) => (
          <li key={alert.id} className="min-w-0 truncate">
            {alert.listing.trackedLotId ? (
              <Link href={`/lotes/${alert.listing.trackedLotId}`} className="hover:text-foreground hover:underline">
                {alert.listing.title}
              </Link>
            ) : (
              alert.listing.title
            )}
          </li>
        ))}
      </ul>
      <ButtonLink href="/alertas" variant="secondary" size="sm">
        Ver alertas
      </ButtonLink>
    </section>
  );
}
