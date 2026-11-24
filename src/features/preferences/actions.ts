"use server";

import { refresh, revalidatePath } from "next/cache";

import { type ActionState, formValues, validationError } from "@/lib/action-state";

import { resetUserPreferences, upsertUserPreferences, type UpsertUserPreferencesError } from "./mutations";
import { searchMunicipalities } from "./queries";
import { municipalitySearchSchema, userPreferencesInputSchema } from "./schemas";
import type { MunicipalityOption } from "./types";

const UPSERT_ERRORS = {
  invalid_municipality: "Município não encontrado na base do IBGE.",
} satisfies Record<UpsertUserPreferencesError, string>;

function revalidateAffectedRoutes() {
  revalidatePath("/sistema/preferencias");
  revalidatePath("/dashboard");
  revalidatePath("/leiloes");
  revalidatePath("/leiloes/veiculos");
  revalidatePath("/minhas-analises");
  revalidatePath("/monitores");
  revalidatePath("/mercado");
  revalidatePath("/mercado/panorama");
  refresh();
}

export async function saveUserPreferencesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = userPreferencesInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await upsertUserPreferences(parsed.data);
  if (!result.ok) {
    return {
      status: "error",
      message: "Revise os campos destacados.",
      fieldErrors: { municipalityIbgeCode: [UPSERT_ERRORS[result.error]] },
      values: formValues(formData),
    };
  }

  revalidateAffectedRoutes();
  return { status: "success", message: "Preferências salvas." };
}

export async function resetUserPreferencesAction(_prev: ActionState): Promise<ActionState> {
  await resetUserPreferences();
  revalidateAffectedRoutes();
  return { status: "success", message: "Preferências restauradas para os padrões do sistema." };
}

export async function searchMunicipalitiesAction(query: string): Promise<MunicipalityOption[]> {
  const parsed = municipalitySearchSchema.safeParse(query);
  if (!parsed.success) return [];
  return searchMunicipalities(parsed.data);
}
