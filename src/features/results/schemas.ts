import { z } from "zod";

import { LOT_OUTCOMES, PERSONAL_OUTCOMES } from "@/domain/results/results";
import { checkbox, entityId, optionalPositiveBrlAmount, optionalText, optionalUrl, zonedDateTime } from "@/lib/schemas";

export const lotIdSchema = entityId();

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && (value.trim() === "" || value === "none") ? undefined : value;

const longText = (max: number) => optionalText().pipe(z.string().max(max, `Use até ${max} caracteres.`).optional());

/** Registro ou correção de resultado (SPEC RF-06). Cada envio cria uma revisão; nada é sobrescrito. */
export const resultInputSchema = z
  .object({
    outcome: z.enum(LOT_OUTCOMES, "Selecione o desfecho do lote."),
    finalBid: optionalPositiveBrlAmount(),
    eventAt: z.preprocess(emptyToUndefined, zonedDateTime("Informe data e hora válidas.").optional()),
    sourceUrl: optionalUrl(),
    sourceNotes: longText(2_000),
    analysisId: z.preprocess(emptyToUndefined, entityId().optional()),
    priorDeclared: checkbox(),
    personalOutcome: z.enum(PERSONAL_OUTCOMES, "Selecione sua participação."),
    decisionReason: longText(5_000),
    notes: longText(5_000),
    correctionReason: longText(2_000),
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
    if (Number.isInteger(result.baseRevision) && result.baseRevision > 0 && !result.correctionReason) {
      ctx.addIssue({ code: "custom", path: ["correctionReason"], message: "Informe o motivo da correção." });
    }
  });
export type ResultInput = z.infer<typeof resultInputSchema>;
