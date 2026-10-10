import { z } from "zod";

import { LOT_OUTCOMES, PERSONAL_OUTCOMES } from "@/domain/results/results";
import { zonedStartOfDay } from "@/lib/dates";
import { entityId, optionalPositiveBrlAmount, optionalText } from "@/lib/schemas";

export const lotIdSchema = entityId();

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && (value.trim() === "" || value === "none") ? undefined : value;

/**
 * Registro ou correção de resultado (SPEC RF-06), no modal da ficha (D-54). Cada envio cria uma revisão; nada é
 * sobrescrito. Fonte, motivo e observações não são pedidos: a mutation repete os da revisão anterior.
 */
export const resultInputSchema = z
  .object({
    outcome: z.enum(LOT_OUTCOMES, "Selecione o desfecho do lote."),
    finalBid: optionalPositiveBrlAmount(),
    /** Dia do desfecho ("YYYY-MM-DD"); o horário vem de `resolveEventAt`. */
    eventDate: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .refine((value) => zonedStartOfDay(value) !== null, "Informe uma data válida.")
        .optional(),
    ),
    analysisId: z.preprocess(emptyToUndefined, entityId().optional()),
    personalOutcome: z.enum(PERSONAL_OUTCOMES, "Selecione sua participação."),
    correctionReason: optionalText().pipe(z.string().max(2_000, "Use até 2000 caracteres.").optional()),
    /** Revisão vigente quando o formulário foi aberto (0 = primeiro registro). Evita sobrescrever outra aba. */
    baseRevision: z.coerce.number().int().min(0).catch(0),
  })
  // No Zod 4 as regras cruzadas rodam mesmo com campo inválido: cada uma confere os tipos que usa.
  .superRefine((result, ctx) => {
    if (result.finalBid !== undefined && result.outcome !== "sold") {
      ctx.addIssue({ code: "custom", path: ["finalBid"], message: "Preço final só se aplica a lote arrematado." });
    }
    if (result.personalOutcome === "won" && (result.outcome !== "sold" || result.finalBid === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["personalOutcome"],
        message: "“Arrematei” exige desfecho arrematado e preço final informado.",
      });
    }
  });
export type ResultInput = z.infer<typeof resultInputSchema>;
