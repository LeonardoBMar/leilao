"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { type ActionState, failure, validationError } from "@/lib/action-state";

import {
  createAuction,
  deleteAuction,
  type DeleteAuctionError,
  markAuctionFinished,
  setAuctionArchived,
  updateAuction,
  type UpdateAuctionError,
} from "./mutations";
import { auctionIdSchema, auctionInputSchema } from "./schemas";

const NOT_FOUND = "Leilão não encontrado.";

const UPDATE_ERRORS = { not_found: NOT_FOUND } satisfies Record<UpdateAuctionError, string>;

const DELETE_ERRORS = {
  not_found: NOT_FOUND,
  has_lots: "Este leilão tem lotes vinculados. Arquive o leilão ou trate os lotes antes de excluí-lo.",
} satisfies Record<DeleteAuctionError, string>;

export async function createAuctionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = auctionInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const auction = await createAuction(parsed.data);
  redirect(`/minhas-analises/leiloes/${auction.id}`);
}

export async function updateAuctionAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsedId = auctionIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);
  const parsed = auctionInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await updateAuction(parsedId.data, parsed.data);
  if (!result.ok) return failure(UPDATE_ERRORS[result.error], formData);

  redirect(`/minhas-analises/leiloes/${parsedId.data}`);
}

export async function setAuctionArchivedAction(id: string, archived: boolean): Promise<ActionState> {
  const parsedId = auctionIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);

  const result = await setAuctionArchived(parsedId.data, archived === true);
  if (!result.ok) return failure(UPDATE_ERRORS[result.error]);

  refresh();
  return { status: "success", message: archived ? "Leilão arquivado." : "Leilão reativado." };
}

export async function markAuctionFinishedAction(id: string): Promise<ActionState> {
  const parsedId = auctionIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);

  const result = await markAuctionFinished(parsedId.data);
  if (!result.ok) return failure(UPDATE_ERRORS[result.error]);

  refresh();
  return { status: "success", message: "Leilão marcado como encerrado." };
}

export async function deleteAuctionAction(id: string): Promise<ActionState> {
  const parsedId = auctionIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);

  const result = await deleteAuction(parsedId.data);
  if (!result.ok) return failure(DELETE_ERRORS[result.error]);

  redirect("/minhas-analises?vista=leilao");
}
