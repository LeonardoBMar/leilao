"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { missingFields } from "@/domain/finance/calculator";
import { type ActionState, failure, type FieldErrors, formValues, validationError } from "@/lib/action-state";
import { entityId } from "@/lib/schemas";

import { FORM_FIELD } from "./labels";
import {
  createDraft,
  type CreateDraftError,
  discardDraft,
  fixAnalysis,
  type FixAnalysisError,
  saveDraft,
} from "./mutations";
import { analysisFormSchema, analysisIdSchema, lotIdSchema, toAnalysisInputs } from "./schemas";

const NOT_FOUND = "Análise não encontrada.";

const CREATE_ERRORS = {
  lot_not_found: "Lote não encontrado.",
  source_not_found: "Versão de origem não encontrada.",
} satisfies Record<CreateDraftError, string>;

const FIX_ERRORS = {
  not_found: NOT_FOUND,
  not_draft: "Esta análise já foi fixada e não pode ser alterada. Crie uma nova versão para revisar.",
  incomplete: "Para fixar, preencha os campos pendentes.",
  market_value_not_positive: "Para fixar, o valor de mercado precisa ser maior que zero.",
} satisfies Record<FixAnalysisError, string>;

const sourceIdSchema = entityId().optional();

/** Abre (ou retoma) o rascunho do lote e leva à tela da análise. */
export async function createAnalysisAction(lotId: string, sourceId?: string): Promise<ActionState> {
  const parsedLot = lotIdSchema.safeParse(lotId);
  const parsedSource = sourceIdSchema.safeParse(sourceId);
  if (!parsedLot.success) return failure(CREATE_ERRORS.lot_not_found);
  if (!parsedSource.success) return failure(CREATE_ERRORS.source_not_found);

  const result = await createDraft(parsedLot.data, parsedSource.data);
  if (!result.ok) return failure(CREATE_ERRORS[result.error]);

  redirect(`/analise/${result.value.id}`);
}

/** "Salvar rascunho" ou "Fixar análise", conforme o botão acionado (`intent`). */
export async function saveAnalysisAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsedId = analysisIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);
  const parsed = analysisFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const form = parsed.data;

  const saved = await saveDraft(parsedId.data, form);
  if (!saved.ok) return failure(FIX_ERRORS[saved.error], formData);

  if (form.intent === "draft") {
    refresh();
    return { status: "success", message: "Rascunho salvo." };
  }

  // O rascunho já foi salvo acima; pendências voltam como erro de cada campo (CA-07).
  const missing = missingFields(toAnalysisInputs(form));
  if (missing.length > 0) {
    const fieldErrors: FieldErrors = {};
    for (const field of missing) fieldErrors[FORM_FIELD[field]] = ["Obrigatório para fixar."];
    refresh();
    return { status: "error", message: FIX_ERRORS.incomplete, fieldErrors, values: formValues(formData) };
  }

  const fixed = await fixAnalysis(parsedId.data, form);
  if (!fixed.ok) {
    if (fixed.error === "market_value_not_positive") {
      return {
        status: "error",
        message: FIX_ERRORS.market_value_not_positive,
        fieldErrors: { marketValue: ["Deve ser maior que zero para fixar."] },
        values: formValues(formData),
      };
    }
    return failure(FIX_ERRORS[fixed.error], formData);
  }

  refresh();
  return { status: "success", message: "Análise fixada. As premissas e o limite foram preservados." };
}

export async function discardDraftAction(id: string): Promise<ActionState> {
  const parsedId = analysisIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);

  const result = await discardDraft(parsedId.data);
  if (!result.ok) return failure(FIX_ERRORS[result.error]);

  redirect(`/lotes/${result.value.lotId}`);
}
