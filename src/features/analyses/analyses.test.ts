import { describe, expect, it } from "vitest";
import { z } from "zod";

import { calculateMaxBid, missingFields, simulateBid } from "@/domain/finance/calculator";
import { cents } from "@/domain/money";

import { defaultsInputFromListing, draftDefaults, draftSourceOf, UNKNOWN_VEHICLE } from "./draft-defaults";
import { fipeFill } from "./fipe-fill";
import { FORM_FIELD, limitPositionText } from "./labels";
import { readMarketSnapshot, snapshotOf } from "./market-snapshot";
import { readAnalysisInputs } from "./read-inputs";
import { analysisFormSchema, fixDraftIdsSchema, toAnalysisInputs } from "./schemas";
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
  debtsCost: "0",
  sellingCost: "0",
  taxCost: "0",
  expectedHoldDays: "",
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

  it("análise fixada legada (v2) sem débitos/venda/impostos continua válida em modo leitura", () => {
    const inputs = {
      ...toAnalysisInputs(analysisFormSchema.parse(fixedCommissionForm)),
      debtsCost: null,
      sellingCost: null,
      taxCost: null,
    };
    const model = fixedSummary(inputs, {
      isViable: true,
      maxBid: cents(3_320_000),
      totalAtMaxBid: cents(4_400_000),
      marginAtMaxBid: cents(600_000),
      formulaVersion: 2,
    });
    expect(model.outcome).toMatchObject({ kind: "viable", maxBid: 3_320_000, fixedCosts: 680_000 });
  });
});

describe("reserva e margem em % (D-38)", () => {
  it("formulário em %: o valor em R$ não é guardado e o limite usa o % do valor de venda", () => {
    const form = analysisFormSchema.parse({
      ...fixedCommissionForm,
      riskReserve: "",
      desiredMargin: "999",
      riskReserveRate: "4",
      desiredMarginRate: "12",
    });
    const inputs = toAnalysisInputs(form);
    expect(inputs).toMatchObject({ riskReserve: null, riskReserveRateBps: 400, desiredMargin: null });
    expect(calculateMaxBid(inputs)).toEqual(
      calculateMaxBid(toAnalysisInputs(analysisFormSchema.parse(fixedCommissionForm))),
    );
  });

  it("prévia no navegador lê o %", () => {
    const inputs = readAnalysisInputs(toFormData({ ...fixedCommissionForm, desiredMarginRate: "15" }));
    expect(inputs).toMatchObject({ desiredMargin: null, desiredMarginRateBps: 1_500 });
  });
});

describe("draftDefaults", () => {
  it("rascunho padrão de anúncio: colunas preenchidas e nota com a origem de cada número", () => {
    const draft = draftDefaults(
      defaultsInputFromListing({
        marketValueCents: 8_000_000,
        marketValueOrigin: "source",
        marketValueRefMonth: null,
        category: "Carros",
        damageLevel: "small",
        conditionFlags: ["airbag_deployed"],
        commissionBps: 500,
        dispatcherFeeCents: null,
        removalFeeCents: 55_000,
        storageFeeCents: 235_000,
        inspectionFeeCents: 25_000,
        otherFeesCents: null,
        municipality: null,
      }),
      {
        name: "Leilo",
        referenceDate: new Date("2026-10-01T12:00:00Z"),
        marketValueOrigin: "source",
        marketValueRefMonth: null,
      },
    );
    expect(draft).toMatchObject({
      marketValueCents: 6_400_000,
      repairCostCents: 2_000_000,
      fipeValueCents: 8_000_000,
      fipeReferenceSource: "Leilo (informado no anúncio)",
      transportCostCents: 55_000,
      otherFeesCents: 260_000,
      documentationCostCents: 150_000,
      commissionMode: "percentage",
      riskReserveBps: 500,
      desiredMarginBps: 1_500,
    });
    expect(draft.notes).toMatch(/FIPE R\$\s80\.000,00 − 20% \(pequena monta\)/);
    expect(draft.notes).toMatch(/airbag acionado/);
    expect(draft.notes).toMatch(/Transporte: remoção do anúncio no Leilo/);
  });

  it("FIPE casada pelo sistema: mês da tabela e a origem na referência (D-47)", () => {
    const listing: Parameters<typeof draftSourceOf>[0] = {
      marketValueCents: 3_000_000,
      marketValueOrigin: "fipe_family",
      marketValueRefMonth: new Date("2026-09-01"),
      category: "Carros",
      damageLevel: null,
      conditionFlags: [],
      commissionBps: null,
      dispatcherFeeCents: null,
      removalFeeCents: null,
      storageFeeCents: null,
      inspectionFeeCents: null,
      otherFeesCents: null,
      municipality: null,
      lastCheckedAt: new Date("2026-10-01T12:00:00Z"),
      source: { name: "Freitas" },
    };
    const draft = draftDefaults(defaultsInputFromListing(listing), draftSourceOf(listing));
    expect(draft).toMatchObject({
      fipeValueCents: 3_000_000,
      fipeReferenceMonth: new Date("2026-09-01"),
      fipeReferenceSource: "Tabela FIPE (casada pelo sistema, versão aproximada)",
    });
  });

  it("lote sem anúncio: só os custos fixos; venda e reparos esperam a FIPE", () => {
    const draft = draftDefaults(UNKNOWN_VEHICLE, null);
    expect(draft).toMatchObject({ marketValueCents: null, repairCostCents: null, tiresCostCents: 240_000 });
    expect(draft.notes).toMatch(/Estimar a partir da FIPE/);
  });
});

describe("limitPositionText (bloco Concorrência)", () => {
  const position = (below: number, above: number, equal = 0) => ({
    n: below + above + equal,
    below,
    above,
    equal,
    percentile: Math.round(((below + equal / 2) / (below + above + equal)) * 100),
  });

  it("conta quem saiu acima, com o percentil", () => {
    expect(limitPositionText(position(4, 14))).toBe("fica abaixo de 14 das 18 vendas parecidas (P22)");
    expect(limitPositionText(position(2, 3, 1))).toBe("fica abaixo de 3 das 6 vendas parecidas e empata com 1 (P42)");
  });

  it("nas pontas, todas; com uma venda, a única", () => {
    expect(limitPositionText(position(0, 5))).toBe("fica abaixo de todas as 5 vendas parecidas (P0)");
    expect(limitPositionText(position(5, 0))).toBe("fica acima de todas as 5 vendas parecidas (P100)");
    expect(limitPositionText(position(1, 0))).toBe("fica acima da única venda parecida (P100)");
    expect(limitPositionText(position(0, 0, 2))).toBe("empata com todas as 2 vendas parecidas (P50)");
  });
});

describe("fipeFill (Usar FIPE do anúncio)", () => {
  const fipe = {
    value: cents(6_543_210),
    refMonth: new Date(Date.UTC(2026, 9, 1)),
    source: "Tabela FIPE (casada pelo sistema)",
  };
  const empty = { fipeValue: "", fipeReferenceMonth: "", fipeReferenceSource: "" };

  it("preenche valor, mês e origem quando estão vazios", () => {
    expect(fipeFill(empty, fipe)).toEqual({
      fipeValue: "65432,10",
      fipeReferenceMonth: "2026-10",
      fipeReferenceSource: "Tabela FIPE (casada pelo sistema)",
    });
  });

  it("não sobrescreve o que foi digitado", () => {
    expect(fipeFill({ ...empty, fipeValue: "50.000,00", fipeReferenceSource: "minha consulta" }, fipe)).toEqual({
      fipeReferenceMonth: "2026-10",
    });
    expect(fipeFill({ fipeValue: "1", fipeReferenceMonth: "2026-01", fipeReferenceSource: "x" }, fipe)).toEqual({});
  });

  it("sem mês no anúncio, o mês fica como está", () => {
    expect(fipeFill(empty, { ...fipe, refMonth: null })).not.toHaveProperty("fipeReferenceMonth");
  });
});

describe("snapshot de mercado (D-74)", () => {
  const market = {
    level: "model" as const,
    scope: "Chevrolet Onix · 2022 a 2024 · Sem monta declarada",
    href: "/mercado?lote=x" as const,
    sales: [
      { id: "a", finalBid: cents(4_000_000) },
      { id: "b", finalBid: cents(5_000_000) },
    ],
    band: { low: cents(4_100_000), median: cents(4_500_000), high: cents(4_900_000), confidence: "low" as const },
  };

  it("o que a fixação grava é lido de volta igual (passando por JSON)", () => {
    const at = new Date(Date.UTC(2026, 9, 11, 20, 30));
    const stored: unknown = JSON.parse(JSON.stringify(snapshotOf(market, at)));
    expect(readMarketSnapshot(stored)).toEqual({
      version: 1,
      computedAt: at,
      level: "model",
      scope: market.scope,
      sales: market.sales,
      excludedIds: [],
      band: market.band,
    });
  });

  it("sem snapshot ou com formato desconhecido, `null`", () => {
    expect(readMarketSnapshot(null)).toBeNull();
    expect(readMarketSnapshot({ version: 2 })).toBeNull();
  });
});

describe("fixDraftIdsSchema", () => {
  const uuid = "0199a1b2-c3d4-7000-8000-000000000001";

  it("aceita lista válida de ids", () => {
    expect(fixDraftIdsSchema.parse([uuid])).toEqual([uuid]);
  });

  it("rejeita lista vazia, id inválido e mais de 50 itens", () => {
    expect(fixDraftIdsSchema.safeParse([]).success).toBe(false);
    expect(fixDraftIdsSchema.safeParse(["nao-e-uuid"]).success).toBe(false);
    expect(fixDraftIdsSchema.safeParse(Array.from({ length: 51 }, () => uuid)).success).toBe(false);
  });
});
