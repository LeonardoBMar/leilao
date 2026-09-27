import { describe, expect, it } from "vitest";
import { z } from "zod";

import { resultInputSchema } from "./schemas";

const soldForm = {
  outcome: "sold",
  finalBid: "35.500",
  eventAt: "2026-10-02T15:30",
  sourceUrl: "",
  sourceNotes: "Resultado publicado no site do leiloeiro",
  analysisId: "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
  personalOutcome: "observed",
  decisionReason: "",
  notes: "",
  correctionReason: "",
  baseRevision: "0",
};

function errors(input: Record<string, string>) {
  const result = resultInputSchema.safeParse(input);
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
}

describe("resultInputSchema — RF-06", () => {
  it("normaliza um resultado arrematado", () => {
    expect(resultInputSchema.parse(soldForm)).toMatchObject({
      outcome: "sold",
      finalBid: 3_550_000,
      eventAt: new Date("2026-10-02T18:30:00.000Z"),
      analysisId: "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      priorDeclared: false,
      baseRevision: 0,
    });
  });

  it("“nenhuma” análise e data vazia viram ausentes", () => {
    expect(resultInputSchema.parse({ ...soldForm, analysisId: "none", eventAt: "" })).toMatchObject({
      analysisId: undefined,
      eventAt: undefined,
    });
  });

  it("arrematado com preço desconhecido é válido (sem comparação)", () => {
    expect(resultInputSchema.parse({ ...soldForm, finalBid: "" }).finalBid).toBeUndefined();
  });

  it("preço final só em lote arrematado", () => {
    expect(errors({ ...soldForm, outcome: "withdrawn" })).toEqual({
      finalBid: ["Preço final só se aplica a lote arrematado."],
    });
  });

  it("“Arrematei” exige desfecho arrematado e preço final", () => {
    expect(errors({ ...soldForm, personalOutcome: "won", finalBid: "" })).toEqual({
      personalOutcome: ["“Arrematei” exige desfecho arrematado e preço final informado."],
    });
    expect(resultInputSchema.safeParse({ ...soldForm, personalOutcome: "won" }).success).toBe(true);
  });

  it("correção exige motivo (CA-14)", () => {
    expect(errors({ ...soldForm, baseRevision: "1" })).toEqual({ correctionReason: ["Informe o motivo da correção."] });
    expect(
      resultInputSchema.safeParse({ ...soldForm, baseRevision: "1", correctionReason: "Preço corrigido" }).success,
    ).toBe(true);
  });

  it("desfecho obrigatório e preço positivo", () => {
    expect(Object.keys(errors({ ...soldForm, outcome: "", finalBid: "0" })).sort()).toEqual(["finalBid", "outcome"]);
  });
});
