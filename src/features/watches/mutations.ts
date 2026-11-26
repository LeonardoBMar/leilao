import "server-only";

import { criteriaToStored } from "@/domain/listings/criteria";
import type { Prisma } from "@/generated/prisma/client";
import { err, ok, type Result } from "@/lib/result";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { WatchInput } from "./schemas";

export type WatchError = "not_found";

/** Critérios no formato gravado no banco (`Watch`). */
function toWatchData(input: WatchInput) {
  return { name: input.name, ...criteriaToStored(input.criteria) } satisfies Prisma.WatchUpdateManyMutationInput;
}

/** Criado agora: só anúncios vistos daqui em diante geram alerta (`alertsFrom`, padrão do banco). */
export async function createWatch(input: WatchInput): Promise<{ id: string }> {
  const user = await requireUser();
  return db.watch.create({ data: { ...toWatchData(input), ownerId: user.id }, select: { id: true } });
}

/**
 * Critérios novos valem como monitor novo: `alertsFrom` volta para agora, e o que já existia não vira alerta.
 * Alertas antigos ficam: eles registram o que combinou com os critérios da época.
 */
export async function updateWatch(id: string, input: WatchInput): Promise<Result<{ id: string }, WatchError>> {
  const user = await requireUser();
  const { count } = await db.watch.updateMany({
    where: { id, ownerId: user.id },
    data: { ...toWatchData(input), alertsFrom: new Date() },
  });
  return count === 0 ? err("not_found") : ok({ id });
}

/** Religar também recomeça de agora: o que apareceu com o monitor desligado não vira alerta. */
export async function setWatchActive(id: string, active: boolean): Promise<Result<null, WatchError>> {
  const user = await requireUser();
  const { count } = await db.watch.updateMany({
    where: { id, ownerId: user.id, active: !active },
    data: active ? { active, alertsFrom: new Date() } : { active },
  });
  if (count > 0) return ok(null);
  // Nada mudou: já estava no estado pedido (ok) ou não existe.
  const exists = await db.watch.count({ where: { id, ownerId: user.id } });
  return exists > 0 ? ok(null) : err("not_found");
}

/** Exclui o monitor e, em cascata, os alertas dele. */
export async function deleteWatch(id: string): Promise<Result<null, WatchError>> {
  const user = await requireUser();
  const { count } = await db.watch.deleteMany({ where: { id, ownerId: user.id } });
  return count === 0 ? err("not_found") : ok(null);
}
