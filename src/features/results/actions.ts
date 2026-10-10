"use server";

import { refresh } from "next/cache";

import { type ActionState, failure, formValues, validationError } from "@/lib/action-state";

import { recordResult, type RecordResultError } from "./mutations";
import { lotIdSchema, resultInputSchema } from "./schemas";

const RECORD_ERRORS = {
  lot_not_found: "Lote não encontrado.",
  analysis_not_found: "A análise selecionada não é uma versão fixada deste lote.",
  stale: "O resultado deste lote foi alterado depois que você abriu o formulário. Recarregue a página e revise.",
  invalid_date: "A data do desfecho não pode ser futura.",
} satisfies Record<RecordResultError, string>;

/** Campo que recebe cada erro da mutation; os demais viram alerta do formulário. */
const FIELD_OF_ERROR: Partial<Record<RecordResultError, string>> = {
  analysis_not_found: "analysisId",
  invalid_date: "eventDate",
};

export async function recordResultAction(lotId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsedLot = lotIdSchema.safeParse(lotId);
  if (!parsedLot.success) return failure(RECORD_ERRORS.lot_not_found);
  const parsed = resultInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await recordResult(parsedLot.data, parsed.data);
  if (!result.ok) {
    const field = FIELD_OF_ERROR[result.error];
    if (field) {
      return {
        status: "error",
        message: "Revise os campos destacados.",
        fieldErrors: { [field]: [RECORD_ERRORS[result.error]] },
        values: formValues(formData),
      };
    }
    return failure(RECORD_ERRORS[result.error], formData);
  }

  refresh();
  return {
    status: "success",
    message: parsed.data.baseRevision > 0 ? "Resultado corrigido." : "Resultado registrado.",
  };
}
