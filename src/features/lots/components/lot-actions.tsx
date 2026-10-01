"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
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
  DialogTrigger,
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
      <Button
        variant="ghost"
        loading={isPending && !isDeleteOpen}
        onClick={() => run(() => setLotArchivedAction(lotId, !isArchived))}
      >
        {isArchived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
        {isArchived ? "Reativar" : "Arquivar"}
      </Button>

      {canDelete ? (
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost">
              <Trash2 aria-hidden="true" />
              Excluir
            </Button>
          </DialogTrigger>
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
