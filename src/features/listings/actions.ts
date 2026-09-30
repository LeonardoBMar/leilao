"use server";

import { redirect } from "next/navigation";

import { type ActionState, failure } from "@/lib/action-state";
import { entityId } from "@/lib/schemas";

import { addListingToTracker, type AddToTrackerError } from "./mutations";

const ERRORS = {
  not_found: "Anúncio não encontrado.",
  incomplete: "O anúncio não informa marca, modelo, ano ou leilão. Cadastre o lote à mão.",
  lot_number_taken: "Este leilão já tem um lote com esse número ligado a outro anúncio. Confira em Lotes.",
} satisfies Record<AddToTrackerError, string>;

const listingIdSchema = entityId();

/** "Adicionar à análise": leva ao rascunho novo ou, se o anúncio já estava no Tracker, à ficha do lote. */
export async function addListingToTrackerAction(listingId: string): Promise<ActionState> {
  const parsed = listingIdSchema.safeParse(listingId);
  if (!parsed.success) return failure(ERRORS.not_found);

  const result = await addListingToTracker(parsed.data);
  if (!result.ok) return failure(ERRORS[result.error]);

  const outcome = result.value;
  redirect(outcome.kind === "created" ? `/analise/${outcome.analysisId}` : `/lotes/${outcome.lotId}`);
}
