"use server";

import type { Route } from "next";
import { refresh } from "next/cache";

import { type ActionState, failure } from "@/lib/action-state";
import { entityId } from "@/lib/schemas";

import { addListingToTracker, type AddToTrackerError, setListingDismissed } from "./mutations";

const ERRORS = {
  not_found: "Anúncio não encontrado.",
  incomplete: "O anúncio não informa marca, modelo, ano ou leilão. Cadastre o lote à mão.",
  lot_number_taken: "Este leilão já tem um lote com esse número ligado a outro anúncio. Confira em Lotes.",
} satisfies Record<AddToTrackerError, string>;

const listingIdSchema = entityId();

export type AddToTrackerState =
  | { status: "error"; message: string }
  /** `href`: rascunho novo ou, se o anúncio já estava no Tracker, a ficha do lote. */
  | { status: "success"; message: string; href: Route };

/**
 * "Adicionar à análise" sem sair da lista (revisão de usabilidade): cria o rascunho, re-renderiza a tela (o cartão
 * vira "Ver minha análise") e devolve o caminho para o toast oferecer "Abrir análise".
 */
export async function addListingToTrackerAction(listingId: string): Promise<AddToTrackerState> {
  const parsed = listingIdSchema.safeParse(listingId);
  if (!parsed.success) return { status: "error", message: ERRORS.not_found };

  const result = await addListingToTracker(parsed.data);
  if (!result.ok) return { status: "error", message: ERRORS[result.error] };

  refresh();
  const outcome = result.value;
  return outcome.kind === "created"
    ? { status: "success", message: "Adicionado à análise.", href: `/analise/${outcome.analysisId}` as Route }
    : { status: "success", message: "Este anúncio já estava na análise.", href: `/lotes/${outcome.lotId}` as Route };
}

/** "Dispensar" (ou "Desfazer") uma sugestão de "Para analisar agora". */
export async function setListingDismissedAction(listingId: string, dismissed: boolean): Promise<ActionState> {
  const parsed = listingIdSchema.safeParse(listingId);
  if (!parsed.success) return failure(ERRORS.not_found);

  const result = await setListingDismissed(parsed.data, dismissed === true);
  if (!result.ok) return failure(ERRORS[result.error]);

  refresh();
  return { status: "success", message: dismissed ? "Sugestão dispensada." : "Sugestão de volta." };
}
