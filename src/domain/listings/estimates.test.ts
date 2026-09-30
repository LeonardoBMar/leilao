import { describe, expect, it } from "vitest";

import type { AnalysisInputs } from "../finance/calculator";
import { bps, cents } from "../money";
import {
  type AnalysisSample,
  buildEstimateIndex,
  estimateLimit,
  estimatePrice,
  type EstimateSale,
  type EstimateTarget,
  isComparable,
  percentile,
  vehicleKey,
} from "./estimates";

const sale = (overrides: Partial<EstimateSale> = {}): EstimateSale => ({
  brand: "CHEVROLET",
  model: "ONIX 10MT LT1",
  modelYear: 2020,
  mileageKm: 80_000,
  category: "Carros",
  damageLevel: null,
  finalBid: cents(3_000_000),
  marketValue: cents(6_000_000),
  ...overrides,
});

const target = (overrides: Partial<EstimateTarget> = {}): EstimateTarget => ({
  brand: "Chevrolet",
  model: "Onix Plus",
  modelYear: 2020,
  mileageKm: 90_000,
  category: "Carros",
  damageLevel: null,
  marketValue: cents(5_000_000),
  ...overrides,
});

describe("vehicleKey", () => {
  it("fonte e Tracker na mesma chave: sem acento, maiúsculas, marca por extenso e modelo base", () => {
    expect(vehicleKey("CHEVROLET", "ONIX PLUS JOY BLACK")).toBe("CHEVROLET|ONIX");
    expect(vehicleKey("GM", "Onix")).toBe("CHEVROLET|ONIX");
    expect(vehicleKey("VW", "Gol 1.0")).toBe("VOLKSWAGEN|GOL");
    expect(vehicleKey("Citroën", "C3")).toBe("CITROEN|C3");
    expect(vehicleKey("MERCEDES-BENZ", "C180")).toBe(vehicleKey("Mercedes", "C 180".replace(" ", "")));
  });

  it("sem marca ou modelo: sem chave", () => {
    expect(vehicleKey(null, "ONIX")).toBeNull();
    expect(vehicleKey("FIAT", "  ")).toBeNull();
  });
});

describe("isComparable", () => {
  it("ano ±1, mesma condição e até 40 mil km de diferença", () => {
    expect(isComparable(target(), sale({ modelYear: 2021 }))).toBe(true);
    expect(isComparable(target(), sale({ modelYear: 2022 }))).toBe(false);
    expect(isComparable(target(), sale({ damageLevel: "medium" }))).toBe(false);
    expect(isComparable(target(), sale({ mileageKm: 140_000 }))).toBe(false);
    expect(isComparable(target({ mileageKm: null }), sale({ mileageKm: 140_000 }))).toBe(true);
  });
});

describe("estimatePrice", () => {
  it("com 5 comparáveis: mediana e faixa P25–P75 dos lances finais", () => {
    const bids = [2_000_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000];
    const index = buildEstimateIndex(bids.map((bid) => sale({ finalBid: cents(bid) })));
    expect(estimatePrice(target(), index)).toEqual({
      kind: "comparables",
      n: 5,
      median: 3_000_000,
      low: 2_500_000,
      high: 3_500_000,
    });
  });

  it("arredonda para R$ 100", () => {
    const index = buildEstimateIndex(
      [2_012_345, 2_512_345, 3_012_345, 3_512_345, 4_012_345].map((bid) => sale({ finalBid: cents(bid) })),
    );
    expect(estimatePrice(target(), index)).toMatchObject({ median: 3_010_000, low: 2_510_000, high: 3_510_000 });
  });

  it("sem 5 comparáveis: proporção do valor de mercado na mesma categoria e condição", () => {
    // 20 vendas de outro modelo, lance = 50% do mercado; 2 comparáveis não bastam.
    const others = Array.from({ length: 20 }, () =>
      sale({ brand: "FIAT", model: "UNO", finalBid: cents(2_000_000), marketValue: cents(4_000_000) }),
    );
    const index = buildEstimateIndex([...others, sale(), sale()]);
    const estimate = estimatePrice(target(), index);
    expect(estimate).toMatchObject({ kind: "market_ratio", n: 22, median: 2_500_000 });
  });

  it("proporção não mistura condição: sucata tem a sua", () => {
    const salvage = Array.from({ length: 20 }, () =>
      sale({ damageLevel: "salvage", finalBid: cents(1_000_000), marketValue: cents(5_000_000) }),
    );
    const index = buildEstimateIndex(salvage);
    expect(estimatePrice(target({ damageLevel: "salvage", model: "PRISMA" }), index)).toMatchObject({
      kind: "market_ratio",
      median: 1_000_000,
    });
    expect(estimatePrice(target({ model: "PRISMA" }), index)).toEqual({
      kind: "insufficient",
      comparables: 0,
      needed: 5,
    });
  });

  it("sem categoria: não usa a proporção", () => {
    const uncategorized = Array.from({ length: 20 }, () => sale({ model: "UNO", category: null }));
    const index = buildEstimateIndex(uncategorized);
    expect(estimatePrice(target({ category: null }), index)).toMatchObject({ kind: "insufficient" });
  });

  it("sem base e sem valor de mercado: diz quantos comparáveis há", () => {
    const index = buildEstimateIndex([sale(), sale(), sale()]);
    expect(estimatePrice(target({ marketValue: null }), index)).toEqual({
      kind: "insufficient",
      comparables: 3,
      needed: 5,
    });
  });
});

describe("percentile", () => {
  it("interpola como o percentile_cont do Postgres", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([10], 0.25)).toBe(10);
  });
});

describe("estimateLimit", () => {
  const inputs = (overrides: Partial<AnalysisInputs> = {}): AnalysisInputs => ({
    marketValue: cents(5_000_000),
    repairCost: cents(300_000),
    documentationCost: cents(50_000),
    transportCost: cents(40_000),
    tiresCost: cents(0),
    serviceCost: cents(60_000),
    otherFees: cents(250_000),
    commissionMode: "percentage",
    commissionFixed: null,
    commissionRateBps: bps(500),
    riskReserve: cents(200_000),
    desiredMargin: cents(800_000),
    ...overrides,
  });
  const analysis = (overrides: Partial<AnalysisSample> = {}): AnalysisSample => ({
    brand: "Chevrolet",
    model: "Onix",
    modelYear: 2019,
    inputs: inputs(),
    ...overrides,
  });

  it("com 3 análises parecidas: calculadora com a mediana das premissas", () => {
    const estimate = estimateLimit(target(), [analysis(), analysis(), analysis({ modelYear: 2021 })]);
    // V 50.000 − F 7.000 − R 2.000 − M 8.000 = 33.000 = L × 1,05 → L = 31.428,57
    expect(estimate).toEqual({ kind: "estimated", n: 3, maxBid: 3_142_857, marketValueFrom: "listing" });
  });

  it("comissão segue a modalidade da maioria: fixa com a mediana dos valores fixos", () => {
    const fixed = inputs({ commissionMode: "fixed", commissionRateBps: null, commissionFixed: cents(150_000) });
    const estimate = estimateLimit(target(), [analysis({ inputs: fixed }), analysis({ inputs: fixed }), analysis()]);
    // V 50.000 − F 7.000 − K 1.500 − R 2.000 − M 8.000 = 31.500
    expect(estimate).toEqual({ kind: "estimated", n: 3, maxBid: 3_150_000, marketValueFrom: "listing" });
  });

  it("valor de mercado: a FIPE do anúncio; sem ela, a mediana das análises", () => {
    const three = [analysis(), analysis(), analysis()];
    // V 40.000 (anúncio) − 17.000 = 23.000 = L × 1,05 → L = 21.904,76
    expect(estimateLimit(target({ marketValue: cents(4_000_000) }), three)).toEqual({
      kind: "estimated",
      n: 3,
      maxBid: 2_190_476,
      marketValueFrom: "listing",
    });
    expect(estimateLimit(target({ marketValue: null }), three)).toEqual({
      kind: "estimated",
      n: 3,
      maxBid: 3_142_857,
      marketValueFrom: "analyses",
    });
  });

  it("análise incompleta não conta", () => {
    const incomplete = inputs({ desiredMargin: null });
    expect(estimateLimit(target(), [analysis(), analysis(), analysis({ inputs: incomplete })])).toEqual({
      kind: "insufficient",
      analyses: 2,
      needed: 3,
    });
  });

  it("modelo diferente ou ano fora da faixa não conta", () => {
    expect(estimateLimit(target(), [analysis(), analysis({ model: "Prisma" }), analysis({ modelYear: 2015 })])).toEqual(
      { kind: "insufficient", analyses: 1, needed: 3 },
    );
  });

  it("premissas sem lance viável: estimado, mas sem limite", () => {
    const expensive = inputs({ repairCost: cents(6_000_000) });
    expect(
      estimateLimit(target(), [
        analysis({ inputs: expensive }),
        analysis({ inputs: expensive }),
        analysis({ inputs: expensive }),
      ]),
    ).toMatchObject({ kind: "estimated", n: 3, maxBid: null });
  });
});
