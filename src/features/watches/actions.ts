"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { parseListingParams } from "@/features/listings/schemas";
import { type ActionState, failure, validationError } from "@/lib/action-state";

import { createWatch, deleteWatch, setWatchActive, updateWatch, type WatchError } from "./mutations";
import { hasVehicleCriterion, quickWatchSchema, watchIdSchema, watchInputSchema } from "./schemas";

const ERRORS = { not_found: "Monitor não encontrado." } satisfies Record<WatchError, string>;

export async function createWatchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = watchInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  await createWatch(parsed.data);
  redirect("/monitores");
}

/**
 * "Salvar como monitor" sem sair de Leilões: grava os critérios da busca atual (`query`, os parâmetros da URL) com o
 * nome digitado. A busca é revalidada pelo schema de Leilões, como se viesse da URL.
 */
export async function createWatchFromSearchAction(
  query: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = quickWatchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { criteria } = parseListingParams(Object.fromEntries(new URLSearchParams(query)));
  if (!hasVehicleCriterion(criteria)) {
    return failure("Para salvar, busque por marca ou modelo, ou filtre por ano, preço ou % do mercado.", formData);
  }

  await createWatch({ name: parsed.data.name ?? null, criteria });
  refresh();
  return { status: "success", message: "Monitor criado. Os lotes novos que combinarem viram alerta." };
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
