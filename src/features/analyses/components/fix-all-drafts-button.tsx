"use client";

import { Lock } from "lucide-react";
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

import { fixAllDraftsAction } from "../actions";

type FixAllDraftsButtonProps = {
  fixableCount: number;
  totalCount: number;
};

/**
 * Fixa todos os rascunhos prontos do usuário direto do dashboard (útil quando vários lotes foram adicionados com
 * premissas padrão), preservando confirmação antes de tornar as análises imutáveis.
 */
export function FixAllDraftsButton({ fixableCount, totalCount }: FixAllDraftsButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (fixableCount === 0) return null;

  const incompleteCount = Math.max(0, totalCount - fixableCount);
  const triggerLabel =
    incompleteCount === 0
      ? fixableCount === 1
        ? "Fixar rascunho"
        : `Fixar todos (${fixableCount})`
      : `Fixar prontos (${fixableCount})`;

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Lock aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{fixableCount === 1 ? "Fixar 1 análise?" : `Fixar ${fixableCount} análises?`}</DialogTitle>
          <DialogDescription>
            As premissas já preenchidas (incluindo os valores padrão) e o lance máximo calculado serão preservados como
            versões fixadas e não poderão ser editados. Se precisar revisar algum lote depois, basta criar uma nova
            versão.
          </DialogDescription>
          {incompleteCount > 0 ? (
            <p className="text-caption text-warning">
              {incompleteCount === 1 ? "1 rascunho permanece" : `${incompleteCount} rascunhos permanecem`} em aberto por
              ter campos pendentes.
            </p>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            loading={isPending}
            loadingLabel="Fixando…"
            onClick={() =>
              startTransition(async () => {
                const result = await fixAllDraftsAction();
                if (result.status === "error") {
                  toast.error(result.message);
                  return;
                }
                setOpen(false);
                if (result.status === "success" && result.message) toast.success(result.message);
              })
            }
          >
            <Lock aria-hidden="true" />
            {fixableCount === 1 ? "Fixar análise" : `Fixar ${fixableCount} análises`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
