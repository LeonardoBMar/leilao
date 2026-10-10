import { describe, expect, it } from "vitest";
import { z } from "zod";

import { resultInputSchema } from "./schemas";

const soldForm = {
  outcome: "sold",
  finalBid: "35.500",
  eventDate: "2026-10-02",
  analysisId: "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
  personalOutcome: "observed",
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
      eventDate: "2026-10-02",
      analysisId: "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      baseRevision: 0,
    });
  });

  it("“nenhuma” análise e data vazia viram ausentes", () => {
    expect(resultInputSchema.parse({ ...soldForm, analysisId: "none", eventDate: "" })).toMatchObject({
      analysisId: undefined,
      eventDate: undefined,
    });
  });

  it("data inválida", () => {
    expect(errors({ ...soldForm, eventDate: "2026-02-31" })).toEqual({ eventDate: ["Informe uma data válida."] });
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

  it("correção sem motivo é aceita (a mutation registra um motivo padrão)", () => {
    expect(resultInputSchema.parse({ ...soldForm, baseRevision: "1" }).correctionReason).toBeUndefined();
  });

  it("desfecho obrigatório e preço positivo", () => {
    expect(Object.keys(errors({ ...soldForm, outcome: "", finalBid: "0" })).sort()).toEqual(["finalBid", "outcome"]);
  });
});
