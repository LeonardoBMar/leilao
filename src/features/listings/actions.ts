"use server";

import type { Route } from "next";
import { refresh } from "next/cache";
import { z } from "zod";

import { type ActionState, failure } from "@/lib/action-state";
import { entityId } from "@/lib/schemas";

import { addListingToTracker, type AddToTrackerError, setListingDismissed } from "./mutations";

const ERRORS = {
  not_found: "Anúncio não encontrado.",
  incomplete: "O anúncio não informa marca, modelo, ano ou leilão. Cadastre o lote à mão.",
  lot_number_taken: "Este leilão já tem um lote com esse número ligado a outro anúncio. Confira em Lotes.",
} satisfies Record<AddToTrackerError, string>;

const listingIdSchema = entityId();

/** `href`: rascunho novo ou, se o anúncio já estava no Tracker, a ficha do lote. */
export type AddToTrackerData = { href: Route };

/**
 * "Adicionar à análise" sem sair da lista (revisão de usabilidade): cria o rascunho, re-renderiza a tela (o cartão
 * vira "Ver minha análise") e devolve o caminho para o toast oferecer "Abrir análise".
 */
export async function addListingToTrackerAction(listingId: string): Promise<ActionState<AddToTrackerData>> {
  const parsed = listingIdSchema.safeParse(listingId);
  if (!parsed.success) return failure(ERRORS.not_found);

  const result = await addListingToTracker(parsed.data);
  if (!result.ok) return failure(ERRORS[result.error]);

  refresh();
  const outcome = result.value;
  return outcome.kind === "created"
    ? { status: "success", message: "Adicionado à análise.", data: { href: `/analise/${outcome.analysisId}` as Route } }
    : {
        status: "success",
        message: "Este anúncio já estava na análise.",
        data: { href: `/lotes/${outcome.lotId}` as Route },
      };
}

/** "Dispensar" (ou "Desfazer") uma sugestão de "Para analisar agora". */
export async function setListingDismissedAction(listingId: string, dismissed: boolean): Promise<ActionState> {
  const parsed = listingIdSchema.safeParse(listingId);
  const parsedDismissed = z.boolean().safeParse(dismissed);
  if (!parsed.success) return failure(ERRORS.not_found);
  if (!parsedDismissed.success) return failure("Valor inválido.");

  const result = await setListingDismissed(parsed.data, parsedDismissed.data);
  if (!result.ok) return failure(ERRORS[result.error]);

  refresh();
  return { status: "success", message: parsedDismissed.data ? "Sugestão dispensada." : "Sugestão de volta." };
}
