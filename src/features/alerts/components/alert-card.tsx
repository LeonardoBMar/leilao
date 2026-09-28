import { Badge } from "@/components/ui";
import { ListingCard } from "@/features/listings/components/listing-card";
import { formatDateTime } from "@/lib/format";

import type { AlertItem } from "../types";
import { MarkAlertReadButton } from "./alert-buttons";

/** "Novo veículo encontrado": o anúncio com os dados atuais e o monitor que o encontrou. */
export function AlertCard({ alert, eager = false }: { alert: AlertItem; eager?: boolean }) {
  const unread = alert.readAt === null;
  return (
    <ListingCard
      item={alert.listing}
      eager={eager}
      header={
        <div className="grid gap-1">
          <p className="flex flex-wrap items-center gap-2 text-caption font-semibold text-foreground">
            {unread ? <Badge variant="primary">Novo</Badge> : null}
            Novo veículo encontrado
          </p>
          <p className="text-caption text-muted">
            Monitor “{alert.watchTitle}” · {formatDateTime(alert.createdAt)}
          </p>
        </div>
      }
      footer={unread ? <MarkAlertReadButton alertId={alert.id} /> : null}
    />
  );
}
