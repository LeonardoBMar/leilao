"use client";

import { Pause, Play } from "lucide-react";
import { useActionState } from "react";

import { Button, toast } from "@/components/ui";
import { type ActionState, idleState } from "@/lib/action-state";

import { toggleSourceActiveAction } from "../actions";

type SourceToggleButtonProps = {
  sourceId: string;
  sourceName: string;
  active: boolean;
};

export function SourceToggleButton({ sourceId, sourceName, active }: SourceToggleButtonProps) {
  const [, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const next = await toggleSourceActiveAction(prev, formData);
    if (next.status === "success" && next.message) toast.success(next.message);
    else if (next.status === "error" && next.message) toast.error(next.message);
    return next;
  }, idleState);

  return (
    <form action={formAction}>
      <input type="hidden" name="sourceId" value={sourceId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button
        type="submit"
        variant={active ? "secondary" : "primary"}
        size="sm"
        loading={pending}
        loadingLabel={active ? "Pausando…" : "Reativando…"}
        aria-label={active ? `Pausar fonte ${sourceName}` : `Reativar fonte ${sourceName}`}
      >
        {active ? <Pause aria-hidden="true" className="size-3.5" /> : <Play aria-hidden="true" className="size-3.5" />}
        {active ? "Pausar" : "Reativar"}
      </Button>
    </form>
  );
}
