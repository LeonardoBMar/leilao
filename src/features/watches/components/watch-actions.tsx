"use client";

import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import { Button, ConfirmDialog, useActionToast } from "@/components/ui";

import { deleteWatchAction, setWatchActiveAction } from "../actions";

type WatchActionsProps = { watchId: string; title: string; active: boolean };

export function WatchActions({ watchId, title, active }: WatchActionsProps) {
  const { isPending, run } = useActionToast();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        loading={isPending && !isDeleteOpen}
        onClick={() => run(() => setWatchActiveAction(watchId, !active))}
      >
        {active ? <PowerOff aria-hidden="true" /> : <Power aria-hidden="true" />}
        {active ? "Desligar" : "Ligar"}
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href={`/monitores/${watchId}/editar` as Route}>
          <Pencil aria-hidden="true" />
          Editar
        </Link>
      </Button>
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Excluir monitor?"
        description={`“${title}” e os alertas dele serão excluídos. Para só parar de receber alertas, use Desligar.`}
        confirmLabel="Excluir monitor"
        loading={isPending}
        loadingLabel="Excluindo…"
        trigger={
          <Button variant="ghost" size="sm">
            <Trash2 aria-hidden="true" />
            Excluir
          </Button>
        }
        onConfirm={() =>
          run(async () => {
            const result = await deleteWatchAction(watchId);
            if (result.status !== "error") setIsDeleteOpen(false);
            return result;
          })
        }
      />
    </div>
  );
}
