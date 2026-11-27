"use client";

import { SlidersHorizontal } from "lucide-react";

import { Button, ConfirmDialog, useActionToast } from "@/components/ui";
import { mergeSuggestionPatches, type PreferenceCalibrationSuggestion } from "@/domain/research/cost-calibration";
import { formatBps, formatBRL } from "@/lib/format";

import { applyCostCalibrationAction } from "../actions";

/** Botão com confirmação explícita para aplicar sugestões da Calibração 2.0 nas preferências (D-97). */
export function ApplyCalibrationButton({ suggestions }: { suggestions: readonly PreferenceCalibrationSuggestion[] }) {
  const { isPending, run } = useActionToast();
  if (suggestions.length === 0) return null;

  const patch = mergeSuggestionPatches(suggestions);
  const summaryLines: string[] = [];
  if (patch.documentationCost !== undefined) {
    summaryLines.push(`Documentação padrão: ${formatBRL(patch.documentationCost)}`);
  }
  if (patch.riskReserveRateBps !== undefined) {
    summaryLines.push(`Reserva de risco padrão: ${formatBps(patch.riskReserveRateBps)}`);
  }
  if (
    patch.saleDiscountNoneBps !== undefined &&
    patch.saleDiscountSmallBps !== undefined &&
    patch.saleDiscountMediumBps !== undefined &&
    patch.saleDiscountLargeBps !== undefined
  ) {
    summaryLines.push(
      `Descontos sobre a FIPE: ${formatBps(patch.saleDiscountNoneBps)} / ${formatBps(patch.saleDiscountSmallBps)} / ${formatBps(patch.saleDiscountMediumBps)} / ${formatBps(patch.saleDiscountLargeBps)}`,
    );
  }

  return (
    <ConfirmDialog
      title="Aplicar ajustes nas preferências?"
      description={`As premissas padrão de novos rascunhos serão atualizadas com: ${summaryLines.join("; ")}. Análises já fixadas nunca são alteradas.`}
      confirmLabel="Aplicar nas preferências"
      variant="primary"
      loading={isPending}
      loadingLabel="Aplicando…"
      closeOnConfirm
      onConfirm={() => run(() => applyCostCalibrationAction(patch))}
      trigger={
        <Button type="button" variant="secondary" size="sm">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Aplicar ajustes sugeridos nas preferências
        </Button>
      }
    />
  );
}
