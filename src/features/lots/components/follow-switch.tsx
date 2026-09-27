"use client";

import { useOptimistic, useTransition } from "react";

import { Switch, toast } from "@/components/ui";

import { setLotFollowedAction } from "../actions";

/** Estado imediato e reversível (DESIGN.md §5.3): a UI muda na hora e volta se o servidor recusar. */
export function FollowSwitch({ lotId, isFollowed }: { lotId: string; isFollowed: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(isFollowed);
  const [, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    startTransition(async () => {
      setOptimistic(checked);
      const result = await setLotFollowedAction(lotId, checked);
      if (result.status === "error") toast.error(result.message);
    });
  }

  return (
    <Switch
      checked={optimistic}
      onCheckedChange={handleChange}
      label="Acompanhar lote"
      description="Aparece no dashboard enquanto não houver resultado."
    />
  );
}
