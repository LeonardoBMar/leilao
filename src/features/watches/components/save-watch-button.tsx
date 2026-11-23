"use client";

import { BellPlus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ComponentProps, useActionState, useState } from "react";

import { Button, Input, Popover, PopoverContent, PopoverTrigger, toast } from "@/components/ui";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";

import { createWatchFromSearchAction } from "../actions";

/**
 * "Salvar como monitor" em Leilões: pede só o nome e grava a busca atual, sem sair da lista. Para ajustar critérios,
 * o link abre o formulário completo já preenchido.
 */
export function SaveWatchButton({
  query,
  label = "Salvar como monitor",
  variant = "ghost",
  size,
}: {
  query: string;
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} size={size}>
          <BellPlus aria-hidden="true" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <SaveWatchForm query={query} onSaved={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function SaveWatchForm({ query, onSaved }: { query: string; onSaved: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const next = await createWatchFromSearchAction(query, prev, formData);
    if (next.status === "success") {
      onSaved();
      toast.success(next.message ?? "Monitor criado.", {
        action: { label: "Ver monitores", onClick: () => router.push("/monitores") },
      });
    }
    return next;
  }, idleState);

  const fullForm = (query ? `/monitores/novo?${query}` : "/monitores/novo") as Route;

  return (
    <form action={formAction} className="grid gap-3">
      <p className="text-caption text-muted">Avisa quando aparecer um lote novo com os filtros desta busca.</p>
      <Input
        name="name"
        label="Nome (opcional)"
        maxLength={80}
        autoFocus
        defaultValue={fieldValue(state, "name")}
        error={fieldError(state, "name")}
      />
      {state.status === "error" && !state.fieldErrors ? (
        <p className="text-caption text-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" loading={pending} loadingLabel="Salvando…">
        Salvar monitor
      </Button>
      <Link href={fullForm} className="text-caption text-accent hover:underline">
        Ajustar critérios antes de salvar
      </Link>
    </form>
  );
}
