"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Money,
  toast,
} from "@/components/ui";

import { fixAllDraftsAction } from "../actions";
import type { FixableDraftItem } from "../types";

type FixAllDraftsButtonProps = {
  drafts: readonly FixableDraftItem[];
  totalCount: number;
  fixableTotal?: number;
};

/**
 * Fixa rascunhos prontos selecionados direto do dashboard, listando lotes, limites calculados e alerta de
 * premissas padrão antes de tornar as análises imutáveis.
 */
export function FixAllDraftsButton({ drafts, totalCount, fixableTotal }: FixAllDraftsButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => drafts.map((draft) => draft.analysisId));
  const [isPending, startTransition] = useTransition();

  const readyTotal = fixableTotal ?? drafts.length;
  if (readyTotal === 0 || drafts.length === 0) return null;

  const incompleteCount = Math.max(0, totalCount - readyTotal);
  const selectedSet = new Set(selectedIds);
  const selectedToFix = drafts.filter((draft) => selectedSet.has(draft.analysisId)).map((draft) => draft.analysisId);
  const selectedCount = selectedToFix.length;
  const hasSelectedDefault = drafts.some((draft) => selectedSet.has(draft.analysisId) && draft.isDefaultUnreviewed);

  const triggerLabel =
    incompleteCount === 0
      ? readyTotal === 1
        ? "Revisar e fixar"
        : `Revisar e fixar (${readyTotal})`
      : `Fixar prontos (${readyTotal})`;

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (next) setSelectedIds(drafts.map((draft) => draft.analysisId));
    setOpen(next);
  }

  function toggleDraft(analysisId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) return current.includes(analysisId) ? current : [...current, analysisId];
      return current.filter((id) => id !== analysisId);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Lock aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {readyTotal === 1
              ? "Revisar e fixar 1 análise?"
              : `Revisar e fixar ${selectedCount} de ${drafts.length} análises?`}
          </DialogTitle>
          <DialogDescription>
            Confira o limite calculado de cada lote antes de fixar. Análises fixadas não podem ser editadas e passam a
            contar na calibração das suas decisões.
          </DialogDescription>
        </DialogHeader>

        {hasSelectedDefault ? (
          <Alert variant="warning">
            <AlertDescription>
              Há rascunhos selecionados ainda com premissas padrão sem revisão. Se preferir ajustar custos ou valor de
              mercado antes, abra o lote em Revisar.
            </AlertDescription>
          </Alert>
        ) : null}

        <ul
          role="list"
          aria-label="Rascunhos prontos para fixar"
          className="max-h-64 divide-y divide-border overflow-y-auto overscroll-contain rounded-md border border-border"
        >
          {drafts.map((draft) => {
            const checked = selectedSet.has(draft.analysisId);
            return (
              <li key={draft.analysisId} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <Checkbox
                  checked={checked}
                  disabled={isPending}
                  onCheckedChange={(value) => toggleDraft(draft.analysisId, value === true)}
                  containerClassName="min-w-0 flex-1"
                  label={
                    <span className="grid min-w-0 gap-1">
                      <span className="line-clamp-2 font-medium text-foreground">
                        {draft.lotLabel} · v{draft.version}
                      </span>
                      <span className="line-clamp-1 text-caption text-muted">{draft.auctionName}</span>
                      {draft.isDefaultUnreviewed ? (
                        <Badge variant="warning" className="mt-0.5">
                          Premissas padrão
                        </Badge>
                      ) : null}
                    </span>
                  }
                />
                <div className="flex shrink-0 flex-col items-end gap-1 pt-1.5 text-right">
                  <span className="text-caption font-medium text-foreground tabular-nums">
                    {draft.isViable && draft.maxBid !== null ? (
                      <>
                        Lim. <Money value={draft.maxBid} />
                      </>
                    ) : (
                      <span className="text-muted">Sem lance viável</span>
                    )}
                  </span>
                  <Link
                    href={`/analise/${draft.analysisId}`}
                    onClick={() => setOpen(false)}
                    className="inline-flex min-h-10 items-center rounded-sm text-caption font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent sm:min-h-8 pointer-coarse:min-h-11"
                  >
                    Revisar
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="grid gap-1.5 text-caption">
          {readyTotal > drafts.length ? (
            <p className="text-muted">
              Mostrando os {drafts.length} rascunhos mais recentes de {readyTotal} prontos.
            </p>
          ) : null}
          {incompleteCount > 0 ? (
            <p className="text-warning">
              {incompleteCount === 1 ? "1 rascunho permanece" : `${incompleteCount} rascunhos permanecem`} em aberto por
              ter campos pendentes.
            </p>
          ) : null}
          {drafts.length > 5 ? (
            <Link
              href="/minhas-analises"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-10 w-fit items-center rounded-sm font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-2 focus-visible:outline-transparent sm:min-h-8 pointer-coarse:min-h-11"
            >
              Revisar todos em Minhas análises
            </Link>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={selectedCount === 0}
            loading={isPending}
            loadingLabel="Fixando…"
            onClick={() =>
              startTransition(async () => {
                const result = await fixAllDraftsAction(selectedToFix);
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
            {selectedCount === 1 ? "Fixar 1 análise" : `Fixar ${selectedCount} análises`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
