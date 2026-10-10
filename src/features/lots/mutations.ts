import "server-only";

import type { Cents } from "@/domain/money";
import { err, ok, type Result } from "@/lib/result";
import { requireUser } from "@/server/auth";
import { db, isForeignKeyViolation, isUniqueViolation } from "@/server/db";
import { removeObjects } from "@/server/storage";

import type { LotInput } from "./schemas";

/** Opcionais ausentes viram `null`: no update, `undefined` manteria o valor antigo. */
function toLotData(input: LotInput) {
  return {
    lotNumber: input.lotNumber,
    brand: input.brand,
    model: input.model,
    vehicleVersion: input.vehicleVersion ?? null,
    modelYear: input.modelYear,
    manufactureYear: input.manufactureYear ?? null,
    mileageKm: input.mileageKm ?? null,
    startingBidCents: input.startingBid ?? null,
    currentBidCents: input.currentBid ?? null,
    lotUrl: input.lotUrl ?? null,
    isFollowed: input.isFollowed,
    notes: input.notes ?? null,
  };
}

export type SaveLotError = "not_found" | "auction_not_found" | "duplicate_lot_number";

export async function createLot(auctionId: string, input: LotInput): Promise<Result<{ id: string }, SaveLotError>> {
  const user = await requireUser();
  const auction = await db.auction.findFirst({ where: { id: auctionId, ownerId: user.id }, select: { id: true } });
  if (!auction) return err("auction_not_found");

  const data = toLotData(input);
  try {
    const lot = await db.lot.create({
      data: {
        ...data,
        ownerId: user.id,
        auctionId: auction.id,
        currentBidObservedAt: data.currentBidCents === null ? null : new Date(),
      },
      select: { id: true },
    });
    return ok(lot);
  } catch (error) {
    if (isUniqueViolation(error)) return err("duplicate_lot_number");
    throw error;
  }
}

export async function updateLot(id: string, input: LotInput): Promise<Result<null, SaveLotError>> {
  const user = await requireUser();
  const current = await db.lot.findFirst({
    where: { id, ownerId: user.id },
    select: { currentBidCents: true, currentBidObservedAt: true },
  });
  if (!current) return err("not_found");

  // Lance atual e acompanhamento têm controles próprios na ficha; o formulário de edição não os envia.
  const { currentBidCents: _bid, isFollowed: _followed, ...data } = toLotData(input);
  try {
    await db.lot.updateMany({ where: { id, ownerId: user.id }, data });
    return ok(null);
  } catch (error) {
    if (isUniqueViolation(error)) return err("duplicate_lot_number");
    throw error;
  }
}

export type LotStateError = "not_found";

/** Lance atual é a última observação manual (RF-02); a data só muda quando o valor muda. */
export async function updateCurrentBid(id: string, currentBid: Cents | null): Promise<Result<null, LotStateError>> {
  const user = await requireUser();
  const current = await db.lot.findFirst({
    where: { id, ownerId: user.id },
    select: { currentBidCents: true, currentBidObservedAt: true },
  });
  if (!current) return err("not_found");

  await db.lot.updateMany({
    where: { id, ownerId: user.id },
    data: { currentBidCents: currentBid, currentBidObservedAt: observedAt(current, currentBid) },
  });
  return ok(null);
}

export async function setLotFollowed(id: string, isFollowed: boolean): Promise<Result<null, LotStateError>> {
  const user = await requireUser();
  const { count } = await db.lot.updateMany({ where: { id, ownerId: user.id }, data: { isFollowed } });
  return count === 0 ? err("not_found") : ok(null);
}

export async function setLotArchived(id: string, archived: boolean): Promise<Result<null, LotStateError>> {
  const user = await requireUser();
  const { count } = await db.lot.updateMany({
    where: { id, ownerId: user.id },
    data: { archivedAt: archived ? new Date() : null },
  });
  return count === 0 ? err("not_found") : ok(null);
}

/** Ações em lote da lista: só os lotes do usuário entre `ids` mudam; devolve quantos mudaram. */
export async function updateLotsState(
  ids: readonly string[],
  change: { isFollowed: boolean } | { archived: boolean },
): Promise<number> {
  const user = await requireUser();
  const data =
    "isFollowed" in change ? { isFollowed: change.isFollowed } : { archivedAt: change.archived ? new Date() : null };
  const { count } = await db.lot.updateMany({ where: { id: { in: [...ids] }, ownerId: user.id }, data });
  return count;
}

export type DeleteLotError = "not_found" | "has_history";

/**
 * Exclusão definitiva só sem análise fixada e sem resultado (RF-08). Rascunhos saem na mesma transação e os
 * registros de fotos por cascade; os arquivos no Storage são removidos depois do banco.
 */
export async function deleteLot(id: string): Promise<Result<{ auctionId: string }, DeleteLotError>> {
  const user = await requireUser();
  const lot = await db.lot.findFirst({
    where: { id, ownerId: user.id },
    select: {
      auctionId: true,
      images: { select: { storagePath: true } },
      _count: { select: { results: true, analyses: { where: { status: "fixed" } } } },
    },
  });
  if (!lot) return err("not_found");
  if (lot._count.results > 0 || lot._count.analyses > 0) return err("has_history");

  try {
    await db.$transaction([
      db.analysis.deleteMany({ where: { lotId: id, ownerId: user.id, status: "draft" } }),
      db.lot.deleteMany({ where: { id, ownerId: user.id } }),
    ]);
  } catch (error) {
    // Análise fixada ou resultado criado no intervalo: o banco barra (trigger/FK).
    if (isForeignKeyViolation(error)) return err("has_history");
    throw error;
  }
  // Depois do banco: falha no Storage deixa só arquivo órfão, nunca registro apontando para o nada.
  await removeObjects(lot.images.map((image) => image.storagePath));
  return ok({ auctionId: lot.auctionId });
}

function observedAt(
  current: { currentBidCents: number | null; currentBidObservedAt: Date | null },
  next: number | null,
) {
  if (next === null) return null;
  return next === current.currentBidCents ? current.currentBidObservedAt : new Date();
}
