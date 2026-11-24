import { getCollectorStatus } from "@/features/listings/queries";

import { listRecentUnreadAlerts } from "../queries";
import { type CollectorNotification, NotificationsPopover } from "./notifications-popover";

const LIMIT = 5;

function collectorNotificationOf(
  collector: Awaited<ReturnType<typeof getCollectorStatus>>,
): CollectorNotification | null {
  if (collector.health === "failed") {
    return {
      variant: "destructive",
      label:
        collector.failingSources.length > 0 ? `Coleta falhou: ${collector.failingSources.join(", ")}` : "Coleta falhou",
      impact: "Os lances e anúncios das fontes com falha podem estar desatualizados.",
    };
  }
  if (collector.health === "late") {
    return {
      variant: "warning",
      label: "Coleta atrasada",
      impact: "A coleta está atrasada; novos lotes e lances podem levar mais tempo para atualizar.",
    };
  }
  if (collector.health === "ok" && collector.failedListings > 0) {
    return {
      variant: "warning",
      label:
        collector.failedListings === 1
          ? "1 lote com falha na coleta"
          : `${collector.failedListings} lotes com falha na coleta`,
      impact: "Alguns anúncios não puderam ser atualizados na última coleta.",
    };
  }
  return null;
}

/**
 * Notificações do header: concentra falhas/atrasos de coleta e alertas não lidos.
 * Lê a sessão: renderizar dentro de <Suspense>.
 */
export async function NotificationsMenu() {
  const [{ items, total }, collector] = await Promise.all([listRecentUnreadAlerts(LIMIT), getCollectorStatus()]);
  const collectorWarning = collectorNotificationOf(collector);

  return <NotificationsPopover collectorWarning={collectorWarning} alerts={items} unreadTotal={total} />;
}
