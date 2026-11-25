"use server";

import { refresh, updateTag } from "next/cache";

import { type ActionState, failure, validationError } from "@/lib/action-state";

import {
  type ResetFipeMatchError,
  revertFipeMatchToAuto,
  type SaveManualFipeError,
  saveManualFipeMatch,
  setSourceActive,
  type ToggleSourceError,
} from "./mutations";
import { resetFipeMatchSchema, saveManualFipeMatchSchema, toggleSourceSchema } from "./schemas";

const TOGGLE_SOURCE_ERRORS = {
  not_found: "Fonte de coleta não encontrada.",
} satisfies Record<ToggleSourceError, string>;

const SAVE_FIPE_ERRORS = {
  not_found: "Correlação FIPE não encontrada.",
  catalog_empty: "Catálogo FIPE vazio. Importe a tabela mensal antes de corrigir.",
  brand_required: "Escolha o tipo de veículo e a marca na tabela FIPE antes de selecionar versões.",
  invalid_models: "Uma ou mais versões selecionadas não pertencem a este veículo na tabela FIPE.",
} satisfies Record<SaveManualFipeError, string>;

const RESET_FIPE_ERRORS = {
  not_found: "Correlação FIPE não encontrada.",
} satisfies Record<ResetFipeMatchError, string>;

export async function toggleSourceActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = toggleSourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await setSourceActive(parsed.data.sourceId, parsed.data.active);
  if (!result.ok) return failure(TOGGLE_SOURCE_ERRORS[result.error], formData);

  updateTag("collector-status");
  updateTag("catalog-sources");
  updateTag("catalog-research");
  refresh();
  return {
    status: "success",
    message: result.value.active ? "Fonte reativada para as próximas coletas." : "Fonte pausada.",
  };
}

export async function saveManualFipeMatchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = saveManualFipeMatchSchema.safeParse({
    matchId: formData.get("matchId"),
    mode: formData.get("mode"),
    vehicleType: formData.get("vehicleType") || undefined,
    brandCode: formData.get("brandCode") || undefined,
    modelCodes: formData.getAll("modelCodes").filter((entry): entry is string => typeof entry === "string"),
  });
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await saveManualFipeMatch(parsed.data);
  if (!result.ok) return failure(SAVE_FIPE_ERRORS[result.error], formData);

  refresh();
  const { requeued } = result.value;
  return {
    status: "success",
    message:
      requeued === 0
        ? "Correlação FIPE salva."
        : requeued === 1
          ? "Correlação FIPE salva. 1 anúncio voltou à fila."
          : `Correlação FIPE salva. ${requeued} anúncios voltaram à fila.`,
  };
}

export async function revertFipeMatchToAutoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetFipeMatchSchema.safeParse({ matchId: formData.get("matchId") });
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await revertFipeMatchToAuto(parsed.data.matchId);
  if (!result.ok) return failure(RESET_FIPE_ERRORS[result.error], formData);

  refresh();
  const { requeued } = result.value;
  return {
    status: "success",
    message:
      requeued === 0
        ? "Correlação devolvida para a regra automática."
        : requeued === 1
          ? "Correlação devolvida para a regra automática. 1 anúncio voltou à fila."
          : `Correlação devolvida para a regra automática. ${requeued} anúncios voltaram à fila.`,
  };
}
