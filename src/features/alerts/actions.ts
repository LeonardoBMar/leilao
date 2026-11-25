"use server";

import { refresh } from "next/cache";

import { type ActionState, failure } from "@/lib/action-state";
import { entityId } from "@/lib/schemas";

import { type AlertError, markAlertRead, markAllAlertsRead } from "./mutations";
import { alertIdSchema } from "./schemas";

const watchIdSchema = entityId();

const ERRORS = { not_found: "Alerta não encontrado." } satisfies Record<AlertError, string>;

export async function markAlertReadAction(id: string): Promise<ActionState> {
  const parsedId = alertIdSchema.safeParse(id);
  if (!parsedId.success) return failure(ERRORS.not_found);

  const result = await markAlertRead(parsedId.data);
  if (!result.ok) return failure(ERRORS[result.error]);

  refresh();
  return { status: "success" };
}

/** `watchId` vazio: todos os monitores. */
export async function markAllAlertsReadAction(watchId: string | null): Promise<ActionState> {
  const parsedId = watchId === null ? null : watchIdSchema.safeParse(watchId);
  if (parsedId && !parsedId.success) return failure("Monitor não encontrado.");

  const count = await markAllAlertsRead(parsedId?.data);
  refresh();
  return {
    status: "success",
    message: count === 1 ? "1 alerta marcado como lido." : `${count} alertas marcados como lidos.`,
  };
}
