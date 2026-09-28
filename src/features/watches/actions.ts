"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { type ActionState, failure, validationError } from "@/lib/action-state";

import { createWatch, deleteWatch, setWatchActive, updateWatch, type WatchError } from "./mutations";
import { watchIdSchema, watchInputSchema } from "./schemas";

const ERRORS = { not_found: "Monitor não encontrado." } satisfies Record<WatchError, string>;

export async function createWatchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = watchInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  await createWatch(parsed.data);
  redirect("/monitores");
}

export async function updateWatchAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsedId = watchIdSchema.safeParse(id);
  if (!parsedId.success) return failure(ERRORS.not_found);
  const parsed = watchInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await updateWatch(parsedId.data, parsed.data);
  if (!result.ok) return failure(ERRORS[result.error], formData);

  redirect("/monitores");
}

export async function setWatchActiveAction(id: string, active: boolean): Promise<ActionState> {
  const parsedId = watchIdSchema.safeParse(id);
  if (!parsedId.success) return failure(ERRORS.not_found);

  const result = await setWatchActive(parsedId.data, active === true);
  if (!result.ok) return failure(ERRORS[result.error]);

  refresh();
  return { status: "success", message: active ? "Monitor ligado." : "Monitor desligado." };
}

export async function deleteWatchAction(id: string): Promise<ActionState> {
  const parsedId = watchIdSchema.safeParse(id);
  if (!parsedId.success) return failure(ERRORS.not_found);

  const result = await deleteWatch(parsedId.data);
  if (!result.ok) return failure(ERRORS[result.error]);

  refresh();
  return { status: "success", message: "Monitor excluído." };
}
