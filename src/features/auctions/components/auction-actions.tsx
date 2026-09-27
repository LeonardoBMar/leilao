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

import { deleteAuctionAction, setAuctionArchivedAction } from "../actions";

type AuctionActionsProps = {
  auctionId: string;
  auctionName: string;
  isArchived: boolean;
  /** Exclusão definitiva só sem lotes vinculados (RF-08). */
  canDelete: boolean;
};

export function AuctionActions({ auctionId, auctionName, isArchived, canDelete }: AuctionActionsProps) {
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
        variant="secondary"
        loading={isPending && !isDeleteOpen}
        onClick={() => run(() => setAuctionArchivedAction(auctionId, !isArchived))}
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
              <DialogTitle>Excluir leilão?</DialogTitle>
              <DialogDescription>
                “{auctionName}” será excluído definitivamente. Esta ação não pode ser desfeita. Para apenas tirá-lo das
                listas, use Arquivar.
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
                onClick={() => run(() => deleteAuctionAction(auctionId))}
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
