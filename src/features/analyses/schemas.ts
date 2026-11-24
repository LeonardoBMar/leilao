import { z } from "zod";

import type { AnalysisInputs } from "@/domain/finance/calculator";
import { type Cents, parsePercent } from "@/domain/money";
import { calendarDateToUtc, monthToUtc } from "@/lib/dates";
import { checkbox, entityId, optionalBrlAmount, optionalText } from "@/lib/schemas";

export const analysisIdSchema = entityId();
export const lotIdSchema = entityId();
export const analysisCompareSearchSchema = z.object({
  comparar: entityId().optional().catch(undefined),
});
export const fixDraftIdsSchema = z.array(entityId()).min(1, "Selecione ao menos um rascunho para fixar.").max(50);

const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

/** Texto opcional convertido por `parse`; resultado `null` vira erro do campo. */
function optionalParsed<T>(parse: (value: string) => T | null, message: string) {
  return z.preprocess(
    emptyToUndefined,
    z
      .string()
      .transform((value, ctx) => {
        const parsed = parse(value);
        if (parsed === null) {
          ctx.addIssue({ code: "custom", message });
          return z.NEVER;
        }
        return parsed;
      })
      .optional(),
  );
}

const optionalCalendarDate = () => optionalParsed(calendarDateToUtc, "Informe uma data válida.");
const optionalMonth = () => optionalParsed(monthToUtc, "Informe um mês válido.");
const optionalPercent = () => optionalParsed(parsePercent, "Informe um percentual entre 0 e 100, com até duas casas.");

const optionalSource = () => optionalText().pipe(z.string().max(200, "Use até 200 caracteres.").optional());

/**
 * Formulário da análise (SPEC RF-04). Tudo é opcional porque rascunhos aceitam dados incompletos;
 * a completude para fixar é verificada pelo domínio (`missingFields`). Valores negativos já são barrados aqui.
 */
export const analysisFormSchema = z.object({
  marketValue: optionalBrlAmount(),
  marketReferenceDate: optionalCalendarDate(),
  marketReferenceSource: optionalSource(),
  fipeValue: optionalBrlAmount(),
  fipeReferenceMonth: optionalMonth(),
  fipeReferenceSource: optionalSource(),
  repairCost: optionalBrlAmount(),
  documentationCost: optionalBrlAmount(),
  transportCost: optionalBrlAmount(),
  tiresCost: optionalBrlAmount(),
  serviceCost: optionalBrlAmount(),
  otherFees: optionalBrlAmount(),
  commissionMode: z.preprocess(emptyToUndefined, z.enum(["fixed", "percentage"]).optional()),
  commissionFixed: optionalBrlAmount(),
  commissionRate: optionalPercent(),
  /** Em R$: só análises anteriores ao % (D-38) mostram estes campos. */
  riskReserve: optionalBrlAmount(),
  desiredMargin: optionalBrlAmount(),
  riskReserveRate: optionalPercent(),
  desiredMarginRate: optionalPercent(),
  notes: optionalText().pipe(z.string().max(10_000, "Use até 10.000 caracteres.").optional()),
  knownResultAtCreation: checkbox(),
  /** Botão acionado: "Salvar rascunho" ou "Fixar análise". */
  intent: z.enum(["draft", "fix"]).catch("draft"),
});
export type AnalysisForm = z.infer<typeof analysisFormSchema>;

/** Entradas do cálculo. A modalidade desativada não guarda valor (SPEC §7.1). */
export function toAnalysisInputs(form: AnalysisForm): AnalysisInputs {
  return {
    marketValue: form.marketValue ?? null,
    repairCost: form.repairCost ?? null,
    documentationCost: form.documentationCost ?? null,
    transportCost: form.transportCost ?? null,
    tiresCost: form.tiresCost ?? null,
    serviceCost: form.serviceCost ?? null,
    otherFees: form.otherFees ?? null,
    commissionMode: form.commissionMode ?? null,
    commissionFixed: form.commissionMode === "fixed" ? (form.commissionFixed ?? null) : null,
    commissionRateBps: form.commissionMode === "percentage" ? (form.commissionRate ?? null) : null,
    // Informado em %, o valor em R$ é derivado (não fica um número velho guardado).
    riskReserve: form.riskReserveRate === undefined ? (form.riskReserve ?? null) : null,
    riskReserveRateBps: form.riskReserveRate ?? null,
    desiredMargin: form.desiredMarginRate === undefined ? (form.desiredMargin ?? null) : null,
    desiredMarginRateBps: form.desiredMarginRate ?? null,
  };
}

/** Referências de preço e notas: preservadas com a versão, fora do cálculo. */
export type AnalysisReferences = {
  marketReferenceDate: Date | null;
  marketReferenceSource: string | null;
  fipeValue: Cents | null;
  fipeReferenceMonth: Date | null;
  fipeReferenceSource: string | null;
  notes: string | null;
  knownResultAtCreation: boolean;
};

export function toAnalysisReferences(form: AnalysisForm): AnalysisReferences {
  return {
    marketReferenceDate: form.marketReferenceDate ?? null,
    marketReferenceSource: form.marketReferenceSource ?? null,
    fipeValue: form.fipeValue ?? null,
    fipeReferenceMonth: form.fipeReferenceMonth ?? null,
    fipeReferenceSource: form.fipeReferenceSource ?? null,
    notes: form.notes ?? null,
    knownResultAtCreation: form.knownResultAtCreation,
  };
}
