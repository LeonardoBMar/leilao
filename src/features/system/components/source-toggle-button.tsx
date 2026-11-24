"use client";

import { Pause, Play } from "lucide-react";
import { useActionState, useEffect } from "react";

import { Button, toast } from "@/components/ui";
import { idleState } from "@/lib/action-state";

import { toggleSourceActiveAction } from "../actions";

type SourceToggleButtonProps = {
  sourceId: string;
  sourceName: string;
  active: boolean;
};

export function SourceToggleButton({ sourceId, sourceName, active }: SourceToggleButtonProps) {
  const [state, formAction, pending] = useActionState(toggleSourceActiveAction, idleState);

  useEffect(() => {
    if (state.status === "success" && state.message) toast.success(state.message);
    else if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

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
