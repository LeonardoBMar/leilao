"use client";

import { Check, CheckCheck } from "lucide-react";
import { useTransition } from "react";

import { Button, toast } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

import { markAlertReadAction, markAllAlertsReadAction } from "../actions";

function useRunAction() {
  const [isPending, startTransition] = useTransition();
  function run(action: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") toast.error(result.message);
      else if (result.status === "success" && result.message) toast.success(result.message);
    });
  }
  return [isPending, run] as const;
}

export function MarkAlertReadButton({ alertId }: { alertId: string }) {
  const [isPending, run] = useRunAction();
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
  const [isPending, run] = useRunAction();
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
