"use server";

import { redirect } from "next/navigation";

import { type ActionState, failure, formValues, validationError } from "@/lib/action-state";

import { recordResult, type RecordResultError } from "./mutations";
import { lotIdSchema, resultInputSchema } from "./schemas";

const RECORD_ERRORS = {
  lot_not_found: "Lote não encontrado.",
  analysis_not_found: "A análise selecionada não é uma versão fixada deste lote.",
  stale: "O resultado deste lote foi alterado depois que você abriu o formulário. Recarregue a página e revise.",
} satisfies Record<RecordResultError, string>;

export async function recordResultAction(lotId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsedLot = lotIdSchema.safeParse(lotId);
  if (!parsedLot.success) return failure(RECORD_ERRORS.lot_not_found);
  const parsed = resultInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await recordResult(parsedLot.data, parsed.data);
  if (!result.ok) {
    if (result.error === "analysis_not_found") {
      return {
        status: "error",
        message: "Revise os campos destacados.",
        fieldErrors: { analysisId: [RECORD_ERRORS.analysis_not_found] },
        values: formValues(formData),
      };
    }
    return failure(RECORD_ERRORS[result.error], formData);
  }

  redirect(`/lotes/${parsedLot.data}`);
}
