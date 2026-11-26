"use client";

import { Check, CheckCheck } from "lucide-react";

import { Button, useActionToast } from "@/components/ui";

import { markAlertReadAction, markAllAlertsReadAction } from "../actions";

export function MarkAlertReadButton({ alertId }: { alertId: string }) {
  const { isPending, run } = useActionToast();
  return (
    <Button
      variant="secondary"
      size="sm"
      className="w-fit"
      loading={isPending}
      onClick={() => run(() => markAlertReadAction(alertId))}
    >
      <Check aria-hidden="true" />
      Marcar como lido
    </Button>
  );
}

/** `watchId` nulo: todos os monitores. */
export function MarkAllAlertsReadButton({ watchId }: { watchId: string | null }) {
  const { isPending, run } = useActionToast();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={isPending}
      onClick={() => run(() => markAllAlertsReadAction(watchId))}
    >
      <CheckCheck aria-hidden="true" />
      Marcar todos como lidos
    </Button>
  );
}
