"use client";

import { useTransition } from "react";

import type { ActionState } from "@/lib/action-state";

import { toast } from "./toaster";

/** Executa uma Server Action em `useTransition` e exibe `toast.error` ou `toast.success` pelo `ActionState`. */
export function useActionToast() {
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") toast.error(result.message);
      else if (result.status === "success" && result.message) toast.success(result.message);
    });
  }

  return { isPending, run };
}
