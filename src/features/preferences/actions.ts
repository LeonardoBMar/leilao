"use server";

import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";

import { bps, cents } from "@/domain/money";
import type { CalibrationPreferencePatch } from "@/domain/research/cost-calibration";
import { type ActionState, failure, formValues, validationError } from "@/lib/action-state";

import { resetUserPreferences, upsertUserPreferences, type UpsertUserPreferencesError } from "./mutations";
import { getUserPreferences } from "./queries";
import { userPreferencesInputSchema } from "./schemas";

const UPSERT_ERRORS = {
  invalid_municipality: "Município não encontrado na base do IBGE.",
} satisfies Record<UpsertUserPreferencesError, string>;

const calibrationPatchSchema = z
  .object({
    documentationCost: z.number().int().min(0).max(2_000_000).optional(),
    riskReserveRateBps: z.number().int().min(0).max(5_000).optional(),
    saleDiscountNoneBps: z.number().int().min(0).max(8_000).optional(),
    saleDiscountSmallBps: z.number().int().min(0).max(8_000).optional(),
    saleDiscountMediumBps: z.number().int().min(0).max(8_000).optional(),
    saleDiscountLargeBps: z.number().int().min(0).max(8_000).optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), "Nenhum ajuste selecionado.");

function revalidateAffectedRoutes() {
  revalidatePath("/sistema/preferencias");
  revalidatePath("/dashboard");
  revalidatePath("/leiloes");
  revalidatePath("/leiloes/veiculos");
  revalidatePath("/minhas-analises");
  revalidatePath("/monitores");
  revalidatePath("/mercado");
  revalidatePath("/mercado/panorama");
  revalidatePath("/mercado/calibracao");
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

/** Aplica ajustes sugeridos pela Calibração 2.0 nas preferências do usuário após confirmação explícita (D-97). */
export async function applyCostCalibrationAction(patch: CalibrationPreferencePatch): Promise<ActionState> {
  const parsed = calibrationPatchSchema.safeParse(patch);
  if (!parsed.success) return failure("Ajustes de calibração inválidos.");

  const { raw } = await getUserPreferences();
  const next = parsed.data;
  const result = await upsertUserPreferences({
    buyerProfile: raw.buyerProfile,
    municipalityIbgeCode: raw.municipalityIbgeCode,
    radiusKm: raw.radiusKm,
    desiredMarginRateBps: raw.desiredMarginRateBps,
    riskReserveRateBps: next.riskReserveRateBps !== undefined ? bps(next.riskReserveRateBps) : raw.riskReserveRateBps,
    documentationCost: next.documentationCost !== undefined ? cents(next.documentationCost) : raw.documentationCost,
    towBase: raw.towBase,
    towPerKm: raw.towPerKm,
    towUnknownDistance: raw.towUnknownDistance,
    saleDiscountNoneBps:
      next.saleDiscountNoneBps !== undefined ? bps(next.saleDiscountNoneBps) : raw.saleDiscountNoneBps,
    saleDiscountSmallBps:
      next.saleDiscountSmallBps !== undefined ? bps(next.saleDiscountSmallBps) : raw.saleDiscountSmallBps,
    saleDiscountMediumBps:
      next.saleDiscountMediumBps !== undefined ? bps(next.saleDiscountMediumBps) : raw.saleDiscountMediumBps,
    saleDiscountLargeBps:
      next.saleDiscountLargeBps !== undefined ? bps(next.saleDiscountLargeBps) : raw.saleDiscountLargeBps,
  });

  if (!result.ok) return failure(UPSERT_ERRORS[result.error]);

  revalidateAffectedRoutes();
  return { status: "success", message: "Ajustes de calibração aplicados às suas preferências." };
}
