"use client";

import { Archive, ArchiveRestore, Ellipsis, Eye, EyeOff, Pencil } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import {
  Button,
  CurrencyInput,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@/components/ui";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";

import { setLotArchivedAction, setLotFollowedAction, updateCurrentBidAction } from "../actions";

type LotRowMenuProps = {
  lotId: string;
  lotLabel: string;
  currentBid: number | null;
  isFollowed: boolean;
  isArchived: boolean;
};

/** Ações rápidas de uma linha de lote, sem abrir a ficha: lance, acompanhar e arquivar. */
export function LotRowMenu({ lotId, lotLabel, currentBid, isFollowed, isArchived }: LotRowMenuProps) {
  const [isPending, startTransition] = useTransition();
  const [isBidOpen, setIsBidOpen] = useState(false);

  function run(action: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") toast.error(result.message);
      else if (result.status === "success" && result.message) toast.success(result.message);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Ações do ${lotLabel}`} loading={isPending}>
            <Ellipsis aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setIsBidOpen(true)}>
            <Pencil aria-hidden="true" />
            Atualizar lance
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(() => setLotFollowedAction(lotId, !isFollowed))}>
            {isFollowed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            {isFollowed ? "Parar de acompanhar" : "Acompanhar"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(() => setLotArchivedAction(lotId, !isArchived))}>
            {isArchived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
            {isArchived ? "Reativar" : "Arquivar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isBidOpen} onOpenChange={setIsBidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lance atual</DialogTitle>
            <p className="text-body text-foreground-secondary">{lotLabel}</p>
          </DialogHeader>
          <BidForm lotId={lotId} currentBid={currentBid} onSaved={() => setIsBidOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function BidForm({ lotId, currentBid, onSaved }: { lotId: string; currentBid: number | null; onSaved: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const next = await updateCurrentBidAction(lotId, prev, formData);
    if (next.status === "success") {
      onSaved();
      if (next.message) toast.success(next.message);
    }
    return next;
  }, idleState);

  const saved = currentBid === null ? undefined : (currentBid / 100).toFixed(2).replace(".", ",");

  return (
    <form action={formAction} className="grid gap-5">
      <CurrencyInput
        name="currentBid"
        label="Lance atual"
        autoFocus
        defaultValue={fieldValue(state, "currentBid") ?? saved}
        error={fieldError(state, "currentBid")}
        helperText="Deixe vazio para limpar."
      />
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Cancelar</Button>
        </DialogClose>
        <Button type="submit" loading={pending} loadingLabel="Salvando…">
          Salvar lance
        </Button>
      </DialogFooter>
    </form>
  );
}
