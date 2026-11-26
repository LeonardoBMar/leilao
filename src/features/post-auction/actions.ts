"use server";

import { refresh } from "next/cache";

import { type ActionState, failure, validationError } from "@/lib/action-state";

import {
  addLotExpense,
  type DeleteExpenseError,
  deleteLotExpense,
  type PostAuctionMutationError,
  upsertPostAuction,
} from "./mutations";
import { expenseFormSchema, expenseIdSchema, lotIdSchema, postAuctionFormSchema } from "./schemas";

const POST_AUCTION_ERRORS = {
  not_found: "Lote não encontrado.",
  not_won: "O pós-arremate só fica disponível após registrar que você arrematou o lote.",
} satisfies Record<PostAuctionMutationError, string>;

const DELETE_EXPENSE_ERRORS = {
  not_found: "Despesa não encontrada.",
} satisfies Record<DeleteExpenseError, string>;

export async function savePostAuctionAction(
  lotId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsedLot = lotIdSchema.safeParse(lotId);
  if (!parsedLot.success) return failure(POST_AUCTION_ERRORS.not_found);
  const parsed = postAuctionFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await upsertPostAuction(parsedLot.data, parsed.data);
  if (!result.ok) return failure(POST_AUCTION_ERRORS[result.error], formData);

  refresh();
  return { status: "success", message: "Pós-arremate atualizado." };
}

export async function addLotExpenseAction(lotId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsedLot = lotIdSchema.safeParse(lotId);
  if (!parsedLot.success) return failure(POST_AUCTION_ERRORS.not_found);
  const parsed = expenseFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await addLotExpense(parsedLot.data, parsed.data);
  if (!result.ok) return failure(POST_AUCTION_ERRORS[result.error], formData);

  refresh();
  return { status: "success", message: "Despesa registrada." };
}

export async function deleteLotExpenseAction(lotId: string, expenseId: string): Promise<ActionState> {
  const parsedLot = lotIdSchema.safeParse(lotId);
  const parsedExpense = expenseIdSchema.safeParse(expenseId);
  if (!parsedLot.success || !parsedExpense.success) return failure(DELETE_EXPENSE_ERRORS.not_found);

  const result = await deleteLotExpense(parsedLot.data, parsedExpense.data);
  if (!result.ok) return failure(DELETE_EXPENSE_ERRORS[result.error]);

  refresh();
  return { status: "success", message: "Despesa removida." };
}
