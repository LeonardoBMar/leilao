import "server-only";

import { err, ok, type Result } from "@/lib/result";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { ExpenseForm, PostAuctionForm } from "./schemas";

export type PostAuctionMutationError = "not_found" | "not_won";

async function verifyWonLot(lotId: string, ownerId: string): Promise<Result<void, PostAuctionMutationError>> {
  const lot = await db.lot.findFirst({
    where: { id: lotId, ownerId },
    select: {
      id: true,
      results: { orderBy: { revision: "desc" }, take: 1, select: { personalOutcome: true, finalBidCents: true } },
    },
  });
  if (!lot) return err("not_found");
  const current = lot.results[0];
  if (!current || current.personalOutcome !== "won" || current.finalBidCents === null) return err("not_won");
  return ok(undefined);
}

/** Cria ou atualiza a ficha pós-arremate de um lote arrematado pelo usuário (D-96). */
export async function upsertPostAuction(
  lotId: string,
  input: PostAuctionForm,
): Promise<Result<{ id: string }, PostAuctionMutationError>> {
  const user = await requireUser();
  const check = await verifyWonLot(lotId, user.id);
  if (!check.ok) return check;

  const isSold = input.status === "sold";
  const data = {
    status: input.status,
    paymentDueAt: input.paymentDueAt ?? null,
    paidAt: input.paidAt ?? null,
    pickedUpAt: input.pickedUpAt ?? null,
    docReceivedAt: input.docReceivedAt ?? null,
    listedAt: input.listedAt ?? null,
    soldAt: isSold ? (input.soldAt ?? null) : null,
    salePriceCents: isSold ? (input.salePrice ?? null) : null,
    privatePlate: input.privatePlate ?? null,
    notes: input.notes ?? null,
  };

  const saved = await db.lotPostAuction.upsert({
    where: { lotId_ownerId: { lotId, ownerId: user.id } },
    create: { ownerId: user.id, lotId, ...data },
    update: data,
    select: { id: true },
  });

  return ok(saved);
}

/** Lança uma despesa real no pós-arremate e garante o registro da ficha pós-arremate na mesma transação. */
export async function addLotExpense(
  lotId: string,
  input: ExpenseForm,
): Promise<Result<{ id: string }, PostAuctionMutationError>> {
  const user = await requireUser();
  const check = await verifyWonLot(lotId, user.id);
  if (!check.ok) return check;

  const created = await db.$transaction(async (tx) => {
    await tx.lotPostAuction.upsert({
      where: { lotId_ownerId: { lotId, ownerId: user.id } },
      create: { ownerId: user.id, lotId, status: "acquired" },
      update: {},
      select: { id: true },
    });
    return tx.lotExpense.create({
      data: {
        ownerId: user.id,
        lotId,
        category: input.category,
        description: input.description,
        amountCents: input.amount,
        incurredAt: input.incurredAt,
      },
      select: { id: true },
    });
  });

  return ok(created);
}

export type DeleteExpenseError = "not_found";

/** Remove uma despesa real do lote, filtrando por `ownerId` e `lotId`. */
export async function deleteLotExpense(lotId: string, expenseId: string): Promise<Result<void, DeleteExpenseError>> {
  const user = await requireUser();
  const { count } = await db.lotExpense.deleteMany({
    where: { id: expenseId, lotId, ownerId: user.id },
  });
  return count === 0 ? err("not_found") : ok(undefined);
}
