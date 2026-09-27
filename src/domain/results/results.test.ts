import { describe, expect, it } from "vitest";

import { cents } from "@/domain/money";

import { classifyAnalysisTiming, compareResult, type IndicatorItem, limitIndicator } from "./results";

const reais = (value: number) => cents(Math.round(value * 100));
const at = (iso: string) => new Date(iso);
const limit = { isViable: true, maxBid: reais(33_200) } as const;

describe("classifyAnalysisTiming — SPEC §10", () => {
  const base = {
    analysisFixedAt: at("2026-10-01T12:00:00Z"),
    knownResultAtCreation: false,
    firstResultRecordedAt: at("2026-10-05T12:00:00Z"),
    eventAt: at("2026-10-02T13:00:00Z"),
    priorDeclared: false,
  };

  it("anterior: fixada antes do desfecho e do primeiro registro", () => {
    expect(classifyAnalysisTiming(base)).toBe("prior");
  });

  it("retrospectiva: feita conhecendo o resultado", () => {
    expect(classifyAnalysisTiming({ ...base, knownResultAtCreation: true })).toBe("retrospective");
  });

  it("retrospectiva: fixada depois do horário real do desfecho, mesmo antes do cadastro do resultado", () => {
    // Caso do SPEC: analisar hoje e cadastrar amanhã um leilão encerrado na semana anterior.
    expect(classifyAnalysisTiming({ ...base, analysisFixedAt: at("2026-10-03T12:00:00Z") })).toBe("retrospective");
  });

  it("retrospectiva: fixada depois do primeiro registro de resultado", () => {
    expect(classifyAnalysisTiming({ ...base, analysisFixedAt: at("2026-10-06T12:00:00Z"), eventAt: null })).toBe(
      "retrospective",
    );
  });

  it("sem horário real: declarada anterior ou desconhecida (CA-13)", () => {
    expect(classifyAnalysisTiming({ ...base, eventAt: null, priorDeclared: true })).toBe("prior");
    expect(classifyAnalysisTiming({ ...base, eventAt: null, priorDeclared: false })).toBe("unknown");
  });
});

describe("compareResult — SPEC §10", () => {
  it("CA-10: preço final R$ 35.500,00 para limite R$ 33.200,00 → R$ 2.300,00 acima", () => {
    expect(compareResult({ outcome: "sold", finalBid: reais(35_500), limit })).toEqual({
      kind: "comparable",
      comparison: "above_limit",
      finalBid: reais(35_500),
      maxBid: reais(33_200),
      difference: reais(2_300),
    });
  });

  it("CA-11: preço final igual ou inferior ao limite → dentro do limite", () => {
    expect(compareResult({ outcome: "sold", finalBid: reais(33_200), limit })).toMatchObject({
      comparison: "at_limit",
    });
    expect(compareResult({ outcome: "sold", finalBid: reais(30_000), limit })).toMatchObject({
      comparison: "below_limit",
      difference: reais(-3_200),
    });
  });

  it("CA-12: retirado, sem arrematação ou preço desconhecido não produzem comparação", () => {
    for (const outcome of ["unsold", "withdrawn", "cancelled", "unknown"] as const) {
      expect(compareResult({ outcome, finalBid: null, limit })).toEqual({ kind: "not_comparable", reason: "not_sold" });
    }
    expect(compareResult({ outcome: "sold", finalBid: null, limit })).toEqual({
      kind: "not_comparable",
      reason: "unknown_price",
    });
    expect(compareResult({ outcome: "sold", finalBid: reais(1), limit: null })).toEqual({
      kind: "not_comparable",
      reason: "no_analysis",
    });
  });

  it("análise sem lance viável é comparável, mas sem diferença numérica", () => {
    expect(compareResult({ outcome: "sold", finalBid: reais(10_000), limit: { isViable: false } })).toEqual({
      kind: "comparable",
      comparison: "no_viable_bid",
      finalBid: reais(10_000),
      maxBid: null,
      difference: null,
    });
  });
});

describe("limitIndicator — SPEC §10", () => {
  const item = (
    timing: IndicatorItem["timing"],
    finalBid: number | null,
    l: typeof limit | { isViable: false } = limit,
  ) => ({
    timing,
    comparison: compareResult({ outcome: "sold", finalBid: finalBid === null ? null : reais(finalBid), limit: l }),
  });

  it("conta só comparáveis com análise anterior; sem lance viável entra só no denominador (CA-12, CA-13)", () => {
    expect(
      limitIndicator([
        item("prior", 30_000), // dentro
        item("prior", 33_200), // no limite = dentro
        item("prior", 35_500), // acima
        item("prior", 10_000, { isViable: false }), // denominador apenas
        item("retrospective", 30_000), // fora do indicador
        item("unknown", 30_000), // fora do indicador
        item("prior", null), // preço desconhecido: fora
      ]),
    ).toEqual({ comparable: 4, withinLimit: 2 });
  });

  it("sem resultados comparáveis", () => {
    expect(limitIndicator([])).toEqual({ comparable: 0, withinLimit: 0 });
  });
});
