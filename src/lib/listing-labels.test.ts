import { describe, expect, it } from "vitest";

import { cents } from "@/domain/money";

import { priceBasisLabel, priceEvidenceLabel } from "./listing-labels";

const comparables = {
  kind: "comparables",
  level: "model",
  sameOrigin: false,
  confidence: "high",
  n: 24,
  median: cents(3_000_000),
  low: cents(2_500_000),
  high: cents(3_500_000),
  saleIds: [],
} as const;

const ratio = {
  kind: "market_ratio",
  confidence: "low",
  n: 340,
  median: cents(3_000_000),
  low: cents(2_500_000),
  high: cents(3_500_000),
  ratio: { median: 0.5, low: 0.4, high: 0.6 },
} as const;

describe("priceEvidenceLabel", () => {
  it("diz quantas vendas e a confiança; pela proporção, a categoria", () => {
    expect(priceEvidenceLabel(comparables)).toBe("24 vendas, confiança alta");
    expect(priceEvidenceLabel({ ...comparables, n: 1, confidence: "medium" })).toBe("1 venda, confiança média");
    expect(priceEvidenceLabel(ratio)).toBe("pela categoria, confiança baixa");
    expect(priceEvidenceLabel({ kind: "insufficient", comparables: 2, needed: 5 })).toBeNull();
  });
});

describe("priceBasisLabel", () => {
  it("diz o grupo dos comparáveis e a origem quando ela foi usada", () => {
    expect(priceBasisLabel(comparables)).toBe("24 vendas do mesmo modelo, ano ±1 e mesma condição");
    expect(priceBasisLabel({ ...comparables, level: "version", sameOrigin: true })).toBe(
      "24 vendas da mesma versão e da mesma origem, ano ±1 e mesma condição",
    );
    expect(priceBasisLabel(ratio)).toBe("proporção do valor de mercado em 340 vendas da mesma categoria e condição");
  });
});
