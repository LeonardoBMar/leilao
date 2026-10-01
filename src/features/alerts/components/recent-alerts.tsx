import { ButtonLink } from "@/components/ui";

import { listRecentUnreadAlerts } from "../queries";
import { AlertCard } from "./alert-card";

const LIMIT = 3;

/** Alertas não lidos mais recentes no dashboard. Sem nenhum, a seção some. Renderizar dentro de <Suspense>. */
export async function RecentAlerts() {
  const { items, total } = await listRecentUnreadAlerts(LIMIT);
  if (total === 0) return null;

  return (
    <section aria-labelledby="recent-alerts" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="recent-alerts" className="text-heading-3 text-foreground">
          Alertas não lidos ({total})
        </h2>
        <ButtonLink href="/alertas?situacao=nao-lidos" variant="secondary" size="sm">
          Ver todos os alertas
        </ButtonLink>
      </div>
      <ul className="grid gap-x-7 gap-y-11 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((alert) => (
          <li key={alert.id}>
            <AlertCard alert={alert} />
          </li>
        ))}
      </ul>
    </section>
  );
}
