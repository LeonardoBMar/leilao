"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createDraft } from "@/features/analyses/mutations";
import { type ActionState, failure, validationError } from "@/lib/action-state";
import { entityId } from "@/lib/schemas";

import {
  createLot,
  deleteLot,
  type DeleteLotError,
  type LotStateError,
  type SaveLotError,
  setLotArchived,
  setLotFollowed,
  updateCurrentBid,
  updateLot,
  updateLotsState,
} from "./mutations";
import { currentBidInputSchema, lotIdSchema, lotInputSchema } from "./schemas";

const NOT_FOUND = "Lote não encontrado.";
const auctionIdSchema = entityId();

const SAVE_ERRORS = {
  not_found: NOT_FOUND,
  auction_not_found: "Leilão não encontrado.",
  duplicate_lot_number: "Já existe um lote com este número neste leilão.",
} satisfies Record<SaveLotError, string>;

const STATE_ERRORS = { not_found: NOT_FOUND } satisfies Record<LotStateError, string>;

const DELETE_ERRORS = {
  not_found: NOT_FOUND,
  has_history: "Este lote tem análise fixada ou resultado registrado. Arquive-o para preservar o histórico.",
} satisfies Record<DeleteLotError, string>;

export async function createLotAction(auctionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsedAuctionId = auctionIdSchema.safeParse(auctionId);
  if (!parsedAuctionId.success) return failure(SAVE_ERRORS.auction_not_found);
  const parsed = lotInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await createLot(parsedAuctionId.data, parsed.data);
  if (!result.ok) return duplicateOr(result.error, formData);

  // "Cadastrar e analisar": o lote manual sempre precisa de análise; vai direto ao rascunho.
  if (formData.get("intent") === "analyze") {
    const draft = await createDraft(result.value.id);
    if (draft.ok) redirect(`/analise/${draft.value.id}`);
  }
  redirect(`/lotes/${result.value.id}`);
}

export async function updateLotAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);
  const parsed = lotInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await updateLot(parsedId.data, parsed.data);
  if (!result.ok) return duplicateOr(result.error, formData);

  refresh();
  return { status: "success", message: "Lote atualizado." };
}

export async function updateCurrentBidAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);
  const parsed = currentBidInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await updateCurrentBid(parsedId.data, parsed.data.currentBid ?? null);
  if (!result.ok) return failure(STATE_ERRORS[result.error]);

  refresh();
  return { status: "success", message: "Lance atual atualizado." };
}

export async function setLotFollowedAction(id: string, isFollowed: boolean): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);

  const result = await setLotFollowed(parsedId.data, isFollowed === true);
  if (!result.ok) return failure(STATE_ERRORS[result.error]);

  refresh();
  return { status: "success" };
}

export async function setLotArchivedAction(id: string, archived: boolean): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);

  const result = await setLotArchived(parsedId.data, archived === true);
  if (!result.ok) return failure(STATE_ERRORS[result.error]);

  refresh();
  return { status: "success", message: archived ? "Lote arquivado." : "Lote reativado." };
}

export type BulkLotOperation = "follow" | "unfollow" | "archive" | "unarchive";

const bulkLotSchema = z.object({
  ids: z.array(lotIdSchema).min(1).max(100),
  operation: z.enum(["follow", "unfollow", "archive", "unarchive"]),
});

const BULK_CHANGES = {
  follow: { isFollowed: true },
  unfollow: { isFollowed: false },
  archive: { archived: true },
  unarchive: { archived: false },
} satisfies Record<BulkLotOperation, { isFollowed: boolean } | { archived: boolean }>;

const BULK_MESSAGES = {
  follow: ["acompanhado", "acompanhados"],
  unfollow: ["deixou de ser acompanhado", "deixaram de ser acompanhados"],
  archive: ["arquivado", "arquivados"],
  unarchive: ["reativado", "reativados"],
} satisfies Record<BulkLotOperation, readonly [string, string]>;

/** Ações em lote da lista de lotes (Minhas análises). */
export async function bulkLotAction(ids: string[], operation: BulkLotOperation): Promise<ActionState> {
  const parsed = bulkLotSchema.safeParse({ ids, operation });
  if (!parsed.success) return failure("Seleção inválida. Recarregue a página e tente de novo.");

  const count = await updateLotsState(parsed.data.ids, BULK_CHANGES[parsed.data.operation]);
  if (count === 0) return failure("Nenhum dos lotes selecionados foi encontrado.");

  refresh();
  const [one, many] = BULK_MESSAGES[parsed.data.operation];
  return { status: "success", message: count === 1 ? `1 lote ${one}.` : `${count} lotes ${many}.` };
}

export async function deleteLotAction(id: string): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);

  const result = await deleteLot(parsedId.data);
  if (!result.ok) return failure(DELETE_ERRORS[result.error]);

  redirect(`/minhas-analises/leiloes/${result.value.auctionId}`);
}

/** Número repetido é erro do campo, para aparecer junto do "Número do lote" (CA-02). */
function duplicateOr(error: SaveLotError, formData: FormData): ActionState {
  const state = failure(SAVE_ERRORS[error], formData);
  if (error !== "duplicate_lot_number" || state.status !== "error") return state;
  return { ...state, message: "Revise os campos destacados.", fieldErrors: { lotNumber: [SAVE_ERRORS[error]] } };
}
