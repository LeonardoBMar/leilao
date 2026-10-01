"use client";

import { useActionState, useEffect } from "react";

import { Button, CurrencyInput, toast } from "@/components/ui";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";

type CurrentBidFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Valor atual em centavos, para preencher o campo. */
  currentBid: number | null;
};

/** Atualização manual do lance atual, sem sair da ficha (fluxo principal, passo 7). */
export function CurrentBidForm({ action, currentBid }: CurrentBidFormProps) {
  const [state, formAction, pending] = useActionState(action, idleState);

  useEffect(() => {
    if (state.status === "success" && state.message) toast.success(state.message);
  }, [state]);

  const saved = currentBid === null ? undefined : (currentBid / 100).toFixed(2).replace(".", ",");

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <CurrencyInput
        name="currentBid"
        label="Novo lance atual"
        containerClassName="sm:w-72"
        defaultValue={fieldValue(state, "currentBid") ?? saved}
        error={fieldError(state, "currentBid")}
        helperText="Deixe vazio para limpar."
      />
      <Button type="submit" variant="secondary" className="sm:mt-7" loading={pending} loadingLabel="Salvando…">
        Atualizar lance
      </Button>
    </form>
  );
}
