import "server-only";

import { err, ok, type Result } from "@/lib/result";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

export type AlertError = "not_found";

/** Marca um alerta como lido. Já lido continua com a data da primeira leitura. */
export async function markAlertRead(id: string): Promise<Result<null, AlertError>> {
  const user = await requireUser();
  const { count } = await db.alert.updateMany({
    where: { id, ownerId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (count > 0) return ok(null);
  const exists = await db.alert.count({ where: { id, ownerId: user.id } });
  return exists > 0 ? ok(null) : err("not_found");
}

/** Marca como lidos todos os não lidos (de um monitor, quando informado). Devolve quantos mudaram. */
export async function markAllAlertsRead(watchId?: string): Promise<number> {
  const user = await requireUser();
  const { count } = await db.alert.updateMany({
    where: { ownerId: user.id, readAt: null, ...(watchId ? { watchId } : {}) },
    data: { readAt: new Date() },
  });
  return count;
}
