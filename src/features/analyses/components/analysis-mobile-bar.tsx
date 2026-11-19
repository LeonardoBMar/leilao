"use client";

import { Lock, Trash2 } from "lucide-react";
import { useTransition } from "react";

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
import { formatBRL, formatTime } from "@/lib/format";

import { discardDraftAction } from "../actions";
import { FIELD_LABELS } from "../labels";
import type { SummaryModel } from "../summary-model";

export type AutosaveStatus =
  { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: Date } | { kind: "invalid" | "failed" };

/** Barra inferior fixa em telas abaixo de `lg` (DESIGN.md §10): mantém o lance máximo visível durante a edição. */
export function MobileMaxBidBar({
  model,
  pending,
  onFix,
}: {
  model: SummaryModel;
  pending: boolean;
  onFix: () => void;
}) {
  const { outcome } = model;
  return (
    <div
      aria-label="Resumo rápido da análise"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border-strong bg-surface px-4 py-3 shadow-md lg:hidden"
    >
      <div className="mx-auto flex max-w-360 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-muted">Lance máximo</p>
          {outcome.kind === "viable" ? (
            <p className="truncate text-heading-2 font-semibold text-foreground tabular-nums">
              {formatBRL(outcome.maxBid)}
            </p>
          ) : outcome.kind === "not_viable" ? (
            <p className="truncate text-label font-semibold text-warning">Sem lance viável</p>
          ) : (
            <p className="truncate text-label text-muted">
              Falta: {outcome.missing.map((field) => FIELD_LABELS[field]).join(", ")}
            </p>
          )}
        </div>
        <Button type="button" size="sm" onClick={onFix} loading={pending} loadingLabel="Fixando…">
          <Lock aria-hidden="true" />
          Fixar análise
        </Button>
      </div>
    </div>
  );
}

export function AutosaveText({ status }: { status: AutosaveStatus }) {
  const text = {
    idle: null,
    saving: "Salvando…",
    saved: status.kind === "saved" ? `Salvo às ${formatTime(status.at)}` : null,
    invalid: "Não salvo: revise os campos",
    failed: "Não foi possível salvar sozinho",
  }[status.kind];
  if (!text) return null;
  return (
    <p
      className={
        status.kind === "invalid" || status.kind === "failed" ? "text-caption text-warning" : "text-caption text-muted"
      }
      aria-live="polite"
    >
      {text}
    </p>
  );
}

export function DiscardDraftButton({ analysisId }: { analysisId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost">
          <Trash2 aria-hidden="true" />
          Descartar rascunho
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar rascunho?</DialogTitle>
          <DialogDescription>
            Os dados deste rascunho serão removidos. Versões fixadas não são afetadas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Voltar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            loading={isPending}
            loadingLabel="Descartando…"
            onClick={() =>
              startTransition(async () => {
                const result = await discardDraftAction(analysisId);
                if (result.status === "error") toast.error(result.message);
              })
            }
          >
            Descartar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
