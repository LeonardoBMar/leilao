"use client";

import { Archive, ArchiveRestore, Ellipsis, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

import { deleteLotAction, setLotArchivedAction } from "../actions";

type LotActionsProps = {
  lotId: string;
  lotLabel: string;
  isArchived: boolean;
  /** Exclusão definitiva só sem análise fixada e sem resultado (RF-08). */
  canDelete: boolean;
};

/** Ações raras da ficha (arquivar, excluir) num menu "⋯", para não competir com a ação principal. */
export function LotActions({ lotId, lotLabel, isArchived, canDelete }: LotActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

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
          <Button variant="ghost" size="icon" aria-label="Mais ações do lote" loading={isPending && !isDeleteOpen}>
            <Ellipsis aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => run(() => setLotArchivedAction(lotId, !isArchived))}>
            {isArchived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
            {isArchived ? "Reativar" : "Arquivar"}
          </DropdownMenuItem>
          {canDelete ? (
            <DropdownMenuItem destructive onSelect={() => setIsDeleteOpen(true)}>
              <Trash2 aria-hidden="true" />
              Excluir
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canDelete ? (
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir lote?</DialogTitle>
              <DialogDescription>
                “{lotLabel}” e seus rascunhos de análise serão excluídos definitivamente. Esta ação não pode ser
                desfeita. Para apenas tirá-lo das listas, use Arquivar.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button
                variant="destructive"
                loading={isPending}
                loadingLabel="Excluindo…"
                onClick={() => run(() => deleteLotAction(lotId))}
              >
                Excluir definitivamente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
