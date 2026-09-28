"use client";

import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
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

import { deleteWatchAction, setWatchActiveAction } from "../actions";

type WatchActionsProps = { watchId: string; title: string; active: boolean };

export function WatchActions({ watchId, title, active }: WatchActionsProps) {
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
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Trash2 aria-hidden="true" />
            Excluir
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir monitor?</DialogTitle>
            <DialogDescription>
              “{title}” e os alertas dele serão excluídos. Para só parar de receber alertas, use Desligar.
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
              onClick={() =>
                run(async () => {
                  const result = await deleteWatchAction(watchId);
                  if (result.status !== "error") setIsDeleteOpen(false);
                  return result;
                })
              }
            >
              Excluir monitor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
