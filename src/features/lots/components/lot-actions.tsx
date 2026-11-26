"use client";

import { Archive, ArchiveRestore, Ellipsis, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useActionToast,
} from "@/components/ui";

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
  const { isPending, run } = useActionToast();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

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
        <ConfirmDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          title="Excluir lote?"
          description={`“${lotLabel}” e seus rascunhos de análise serão excluídos definitivamente. Esta ação não pode ser desfeita. Para apenas tirá-lo das listas, use Arquivar.`}
          confirmLabel="Excluir definitivamente"
          loading={isPending}
          loadingLabel="Excluindo…"
          onConfirm={() => run(() => deleteLotAction(lotId))}
        />
      ) : null}
    </>
  );
}
