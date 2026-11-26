"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button, ConfirmDialog, useActionToast } from "@/components/ui";

import { deleteAuctionAction, markAuctionFinishedAction, setAuctionArchivedAction } from "../actions";

/** Sugestão quando a data do leilão manual já passou e o status continua agendado ou em andamento. */
export function MarkFinishedButton({ auctionId }: { auctionId: string }) {
  const { isPending, run } = useActionToast();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={isPending}
      loadingLabel="Salvando…"
      onClick={() => run(() => markAuctionFinishedAction(auctionId))}
    >
      Marcar como encerrado
    </Button>
  );
}

type AuctionActionsProps = {
  auctionId: string;
  auctionName: string;
  isArchived: boolean;
  /** Exclusão definitiva só sem lotes vinculados (RF-08). */
  canDelete: boolean;
};

export function AuctionActions({ auctionId, auctionName, isArchived, canDelete }: AuctionActionsProps) {
  const { isPending, run } = useActionToast();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

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
        <ConfirmDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          title="Excluir leilão?"
          description={`“${auctionName}” será excluído definitivamente. Esta ação não pode ser desfeita. Para apenas tirá-lo das listas, use Arquivar.`}
          confirmLabel="Excluir definitivamente"
          loading={isPending}
          loadingLabel="Excluindo…"
          trigger={
            <Button variant="ghost">
              <Trash2 aria-hidden="true" />
              Excluir
            </Button>
          }
          onConfirm={() => run(() => deleteAuctionAction(auctionId))}
        />
      ) : null}
    </>
  );
}
