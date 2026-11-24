"use client";

import { Target, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui";
import { type EvaluateFilters } from "@/domain/research/evaluate";

import type { EvaluateLotContext } from "./evaluate-filter-helpers";

export type UnlinkedLotState = {
  label: string;
  previous: EvaluateFilters;
};

/** Faixa de contexto do lote alvo em comparação, ou aviso com "Desfazer" quando o lote foi desvinculado. */
export function EvaluateLotBanner({
  lotTarget,
  hasActiveLot,
  unlinkedLot,
  onUnlinkLot,
  onRestoreLot,
  onDismissUnlinked,
}: {
  lotTarget: EvaluateLotContext | null;
  hasActiveLot: boolean;
  unlinkedLot: UnlinkedLotState | null;
  onUnlinkLot: () => void;
  onRestoreLot: (previous: EvaluateFilters) => void;
  onDismissUnlinked: () => void;
}) {
  if (lotTarget === null || !hasActiveLot) {
    if (unlinkedLot === null) return null;
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-surface-subtle px-3 py-1.5 text-caption text-foreground-secondary"
      >
        <span>Comparação com {unlinkedLot.label} encerrada ao trocar de modelo.</span>
        <Button
          variant="link"
          size="sm"
          className="h-10 px-1 text-caption"
          onClick={() => onRestoreLot(unlinkedLot.previous)}
        >
          Desfazer
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Fechar aviso de lote desvinculado"
          className="ml-auto"
          onClick={onDismissUnlinked}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-foreground">
      <span className="inline-flex items-center gap-2">
        <Target aria-hidden="true" className="size-4 shrink-0 text-muted" />
        <span>Comparando com o {lotTarget.label}</span>
      </span>
      {lotTarget.details ? (
        <span className="text-caption font-normal text-muted tabular-nums">{lotTarget.details}</span>
      ) : null}
      <Link
        href={`/lotes/${lotTarget.id}`}
        className="inline-flex min-h-10 items-center rounded-sm px-1 text-caption text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
      >
        Ver ficha do lote
      </Link>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Deixar de comparar com o lote"
        className="ml-auto"
        onClick={onUnlinkLot}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
