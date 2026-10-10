import "server-only";

import { err, ok, type Result } from "@/lib/result";
import { requireUser } from "@/server/auth";
import { db, isForeignKeyViolation } from "@/server/db";

import type { AuctionInput } from "./schemas";

/** Opcionais ausentes viram `null`: no update, `undefined` manteria o valor antigo. */
function toAuctionData(input: AuctionInput) {
  return {
    name: input.name,
    auctioneer: input.auctioneer,
    origin: input.origin,
    status: input.status,
    startsAt: input.startsAt,
    city: input.city ?? null,
    state: input.state ?? null,
    noticeUrl: input.noticeUrl ?? null,
    platformUrl: input.platformUrl ?? null,
    notes: input.notes ?? null,
  };
}

/** Sem falha de negócio possível: devolve o id direto (erros inesperados são lançados). */
export async function createAuction(input: AuctionInput): Promise<{ id: string }> {
  const user = await requireUser();
  return db.auction.create({ data: { ...toAuctionData(input), ownerId: user.id }, select: { id: true } });
}

export type UpdateAuctionError = "not_found";

export async function updateAuction(id: string, input: AuctionInput): Promise<Result<null, UpdateAuctionError>> {
  const user = await requireUser();
  // updateMany com ownerId: autorização e escrita na mesma consulta.
  const { count } = await db.auction.updateMany({ where: { id, ownerId: user.id }, data: toAuctionData(input) });
  return count === 0 ? err("not_found") : ok(null);
}

/** Arquivar tira o leilão (e seus lotes) das visões ativas sem apagar histórico (RF-08). */
export async function setAuctionArchived(id: string, archived: boolean): Promise<Result<null, UpdateAuctionError>> {
  const user = await requireUser();
  const { count } = await db.auction.updateMany({
    where: { id, ownerId: user.id },
    data: { archivedAt: archived ? new Date() : null },
  });
  return count === 0 ? err("not_found") : ok(null);
}

/** "Marcar como encerrado": o status do leilão manual é declarado pelo usuário (GUIA §2). */
export async function markAuctionFinished(id: string): Promise<Result<null, UpdateAuctionError>> {
  const user = await requireUser();
  const { count } = await db.auction.updateMany({ where: { id, ownerId: user.id }, data: { status: "finished" } });
  return count === 0 ? err("not_found") : ok(null);
}

export type DeleteAuctionError = "not_found" | "has_lots";

/** Exclusão definitiva só sem lotes vinculados, inclusive arquivados (RF-08). */
export async function deleteAuction(id: string): Promise<Result<null, DeleteAuctionError>> {
  const user = await requireUser();
  const lots = await db.lot.count({ where: { auctionId: id, ownerId: user.id } });
  if (lots > 0) return err("has_lots");

  try {
    const { count } = await db.auction.deleteMany({ where: { id, ownerId: user.id } });
    return count === 0 ? err("not_found") : ok(null);
  } catch (error) {
    // Um lote criado entre a contagem e a exclusão: a FK do banco barra.
    if (isForeignKeyViolation(error)) return err("has_lots");
    throw error;
  }
}
