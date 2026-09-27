import { describe, expect, it } from "vitest";
import { z } from "zod";

import { calculateMaxBid, missingFields, simulateBid } from "@/domain/finance/calculator";
import { cents } from "@/domain/money";

import { FORM_FIELD } from "./labels";
import { readAnalysisInputs } from "./read-inputs";
import { analysisFormSchema, toAnalysisInputs } from "./schemas";
import { fixedSummary, liveSummary } from "./summary-model";

/** Formulário do exemplo 7.3 exatamente como o usuário digitaria. */
const fixedCommissionForm = {
  marketValue: "50.000,00",
  marketReferenceDate: "2026-09-20",
  marketReferenceSource: "Anúncios similares",
  fipeValue: "",
  fipeReferenceMonth: "",
  fipeReferenceSource: "",
  repairCost: "5.000",
  documentationCost: "1.000",
  transportCost: "800",
  tiresCost: "0",
  serviceCost: "0",
  otherFees: "0",
  commissionMode: "fixed",
  commissionFixed: "2.000",
  commissionRate: "",
  riskReserve: "2.000",
  desiredMargin: "6.000",
  notes: "",
  intent: "fix",
};

const toFormData = (values: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
};

describe("do formulário ao limite (critérios de aceite)", () => {
  it("CA-03: comissão fixa → limite R$ 33.200,00; lance de R$ 31.000,00 → custo R$ 41.800,00 e margem R$ 8.200,00", () => {
    const form = analysisFormSchema.parse(fixedCommissionForm);
    const { outcome, complete } = liveSummary(toAnalysisInputs(form));

    expect(outcome).toMatchObject({ kind: "viable", maxBid: 3_320_000 });
    const simulation = complete && simulateBid(complete, cents(3_100_000));
    expect(simulation).toMatchObject({ totalCost: 4_180_000, estimatedMargin: 820_000 });
  });

  it("CA-04: 5% sobre o lance → limite R$ 33.523,81, comissão R$ 1.676,19, margem R$ 6.000,00", () => {
    const form = analysisFormSchema.parse({
      ...fixedCommissionForm,
      commissionMode: "percentage",
      commissionFixed: "2.000", // modalidade desativada: ignorada (SPEC §7.1)
      commissionRate: "5",
    });

    expect(calculateMaxBid(toAnalysisInputs(form))).toMatchObject({
      kind: "viable",
      maxBid: 3_352_381,
      commissionAtMaxBid: 167_619,
      marginAtMaxBid: 600_000,
    });
  });

  it("CA-06: orçamento insuficiente → sem lance viável, sem valor negativo", () => {
    const form = analysisFormSchema.parse({ ...fixedCommissionForm, desiredMargin: "45.000" });
    expect(calculateMaxBid(toAnalysisInputs(form))).toEqual({ kind: "not_viable", fixedCosts: 680_000 });
  });

  it("CA-07: rascunho incompleto é válido, e a fixação aponta os campos pendentes do formulário", () => {
    const form = analysisFormSchema.parse({ ...fixedCommissionForm, tiresCost: "", commissionFixed: "" });
    const missing = missingFields(toAnalysisInputs(form));

    expect(missing.map((field) => FORM_FIELD[field])).toEqual(["tiresCost", "commissionFixed"]);
  });
});

describe("analysisFormSchema", () => {
  it("converte referências: data, mês e percentual", () => {
    const form = analysisFormSchema.parse({
      ...fixedCommissionForm,
      fipeValue: "48.900",
      fipeReferenceMonth: "2026-09",
      commissionMode: "percentage",
      commissionRate: "5,25",
    });

    expect(form.marketReferenceDate?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
    expect(form.fipeReferenceMonth?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(form.commissionRate).toBe(525);
    expect(form.fipeValue).toBe(4_890_000);
  });

  it("rejeita valores negativos, percentual acima de 100% e datas inválidas", () => {
    const result = analysisFormSchema.safeParse({
      ...fixedCommissionForm,
      repairCost: "-1",
      commissionRate: "101",
      marketReferenceDate: "2026-02-30",
    });

    expect(result.success).toBe(false);
    expect(Object.keys(z.flattenError(result.error ?? new z.ZodError([])).fieldErrors).sort()).toEqual([
      "commissionRate",
      "marketReferenceDate",
      "repairCost",
    ]);
  });

  it("botão desconhecido vira salvar rascunho", () => {
    expect(analysisFormSchema.parse({ ...fixedCommissionForm, intent: "x" }).intent).toBe("draft");
  });
});

describe("readAnalysisInputs (prévia no navegador)", () => {
  it("lê o mesmo que o servidor quando o formulário é válido", () => {
    const serverInputs = toAnalysisInputs(analysisFormSchema.parse(fixedCommissionForm));
    expect(readAnalysisInputs(toFormData(fixedCommissionForm))).toEqual(serverInputs);
  });

  it("campo inválido vira pendente, sem lançar", () => {
    const inputs = readAnalysisInputs(toFormData({ ...fixedCommissionForm, repairCost: "abc", riskReserve: "-5" }));
    expect(inputs.repairCost).toBeNull();
    expect(inputs.riskReserve).toBeNull();
  });
});

describe("fixedSummary", () => {
  it("mostra as saídas gravadas e reconstrói a comissão no limite", () => {
    const inputs = toAnalysisInputs(analysisFormSchema.parse(fixedCommissionForm));
    const model = fixedSummary(inputs, {
      isViable: true,
      maxBid: cents(3_320_000),
      totalAtMaxBid: cents(4_400_000),
      marginAtMaxBid: cents(600_000),
      formulaVersion: 1,
    });

    expect(model.outcome).toEqual({
      kind: "viable",
      maxBid: 3_320_000,
      fixedCosts: 680_000,
      commissionAtMaxBid: 200_000,
      totalAtMaxBid: 4_400_000,
      marginAtMaxBid: 600_000,
    });
  });

  it("análise fixada sem lance viável", () => {
    const inputs = toAnalysisInputs(analysisFormSchema.parse(fixedCommissionForm));
    const model = fixedSummary(inputs, {
      isViable: false,
      maxBid: null,
      totalAtMaxBid: null,
      marginAtMaxBid: null,
      formulaVersion: 1,
    });
    expect(model.outcome.kind).toBe("not_viable");
  });
});
