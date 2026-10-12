"use client";

import { Pencil } from "lucide-react";
import { useActionState, useState } from "react";

import { Button, CurrencyInput, Popover, PopoverContent, PopoverTrigger, toast } from "@/components/ui";
import type { Cents } from "@/domain/money";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";
import { formatMoneyInput } from "@/lib/format";

type BidAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type CurrentBidFormProps = {
  action: BidAction;
  /** Valor atual em centavos, para preencher o campo. */
  currentBid: Cents | null;
  /** Lance mantido pelo coletor: o botão vira "Corrigir". */
  isTracked: boolean;
};

/** Atualização manual do lance atual num popover, sem sair da ficha (fluxo principal, passo 7). */
export function CurrentBidForm({ action, currentBid, isTracked }: CurrentBidFormProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="link" size="sm" className="h-auto w-fit px-0">
          <Pencil aria-hidden="true" />
          {isTracked ? "Corrigir lance" : "Atualizar lance"}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <BidForm action={action} currentBid={currentBid} onSaved={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function BidForm({
  action,
  currentBid,
  onSaved,
}: {
  action: BidAction;
  currentBid: Cents | null;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const next = await action(prev, formData);
    if (next.status === "success") {
      onSaved();
      if (next.message) toast.success(next.message);
    }
    return next;
  }, idleState);

  const saved = currentBid === null ? undefined : formatMoneyInput(currentBid);

  return (
    <form action={formAction} className="grid gap-3">
      <CurrencyInput
        name="currentBid"
        label="Lance atual"
        autoFocus
        defaultValue={fieldValue(state, "currentBid") ?? saved}
        error={fieldError(state, "currentBid")}
        helperText="Deixe vazio para limpar."
      />
      <Button type="submit" loading={pending} loadingLabel="Salvando…">
        Salvar lance
      </Button>
    </form>
  );
}
