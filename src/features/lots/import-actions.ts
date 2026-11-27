"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type ActionState, failure, formValues, validationError } from "@/lib/action-state";
import { monthToUtc } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { FETCH_ERROR_NOTICES, importExternalLotForOwner, previewExternalLot } from "@/server/import-lot";

import { confirmImportFormSchema, previewImportInputSchema } from "./import-schemas";
import type { ImportPreviewResult } from "./types";

/** Passo 1 do Importador Universal: extrai dados da URL/texto, casa FIPE e busca comparáveis (D-98). */
export async function previewImportAction(
  _prev: ActionState<ImportPreviewResult>,
  formData: FormData,
): Promise<ActionState<ImportPreviewResult>> {
  await requireUser();
  const parsed = previewImportInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await previewExternalLot({
    url: parsed.data.url,
    rawText: parsed.data.rawText,
  });

  if (!result.ok) {
    return failure(FETCH_ERROR_NOTICES[result.error], formData);
  }

  return {
    status: "success",
    message: `Dados extraídos (${result.value.parsed.auctioneer}). Confira os campos antes de criar o lote.`,
    data: result.value,
  };
}

/** Passo 2 do Importador Universal: cria leilão, lote e rascunho v1 preenchido em transação (D-98). */
export async function confirmImportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = confirmImportFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const data = parsed.data;
  const startsAt = data.startsAtIso ? new Date(data.startsAtIso) : null;
  const validStartsAt = startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null;
  const fipeRefMonth = data.fipeRefMonth ? monthToUtc(data.fipeRefMonth) : null;

  const created = await importExternalLotForOwner(user.id, {
    auctioneer: data.auctioneer,
    auctionName: data.auctionName,
    lotNumber: data.lotNumber,
    brand: data.brand,
    model: data.model,
    vehicleVersion: data.vehicleVersion ?? null,
    manufactureYear: data.manufactureYear ?? null,
    modelYear: data.modelYear,
    mileageKm: data.mileageKm ?? null,
    fuel: data.fuel ?? null,
    damageLevel: data.damageLevel,
    isMotorcycle: data.isMotorcycle,
    currentBidCents: data.currentBid ?? null,
    commissionRateBps: data.commissionRateBps ?? null,
    otherFeesCents: data.otherFees ?? null,
    fipeValueCents: data.fipeValue ?? null,
    fipeRefMonth,
    city: data.city ?? null,
    state: data.state ?? null,
    startsAt: validStartsAt,
    lotUrl: data.lotUrl ?? null,
    notes: data.notes ?? null,
  });

  if (!created.ok) {
    return {
      status: "error",
      message: "Já existe um lote com este número neste leilão. Altere o número do lote ou o nome do leilão.",
      fieldErrors: { lotNumber: ["Número de lote já cadastrado neste leilão."] },
      values: formValues(formData),
    };
  }

  revalidatePath("/minhas-analises");
  revalidatePath(`/minhas-analises/leiloes/${created.value.auctionId}`);
  revalidatePath("/dashboard");
  redirect(`/analise/${created.value.analysisId}`);
}
