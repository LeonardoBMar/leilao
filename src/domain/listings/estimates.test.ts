import { describe, expect, it } from "vitest";

import type { AnalysisInputs } from "../finance/calculator";
import type { DefaultsInput } from "../finance/defaults";
import { bps, cents } from "../money";
import {
  type AnalysisCandidate,
  type AnalysisSample,
  bandOf,
  buildEstimateIndex,
  byAnalysisPriority,
  confidenceOf,
  estimateLimit,
  estimatePrice,
  type EstimateSale,
  type EstimateTarget,
  findComparables,
  isComparable,
  limitFit,
  limitMaxBid,
  percentile,
  type PriceEstimate,
  similarityOf,
} from "./estimates";

const sale = (overrides: Partial<EstimateSale> = {}): EstimateSale => ({
  id: "venda",
  endsAt: new Date("2026-10-01T15:00:00Z"),
  fipeCode: null,
  origin: null,
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
  fipeCode: null,
  origin: null,
  brand: "Chevrolet",
  model: "Onix Plus",
  modelYear: 2020,
  mileageKm: 90_000,
  category: "Carros",
  damageLevel: null,
  marketValue: cents(5_000_000),
  ...overrides,
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
  it("com 5 comparáveis: mediana e faixa de metade das próximas vendas (P12,5–P87,5 com 5)", () => {
    const bids = [2_000_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000];
    const index = buildEstimateIndex(bids.map((bid, n) => sale({ id: `v${n}`, finalBid: cents(bid) })));
    expect(estimatePrice(target(), index)).toEqual({
      kind: "comparables",
      level: "model",
      sameOrigin: false,
      // P25–P75 de R$ 10 mil sobre R$ 30 mil (33%), mas só 5 vendas.
      confidence: "medium",
      n: 5,
      median: 3_000_000,
      low: 2_250_000,
      high: 3_750_000,
      saleIds: ["v0", "v1", "v2", "v3", "v4"],
    });
  });

  it("arredonda para R$ 100", () => {
    const index = buildEstimateIndex(
      [2_012_345, 2_512_345, 3_012_345, 3_512_345, 4_012_345].map((bid) => sale({ finalBid: cents(bid) })),
    );
    expect(estimatePrice(target(), index)).toMatchObject({ median: 3_010_000, low: 2_260_000, high: 3_760_000 });
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

describe("comparáveis em níveis (D-72)", () => {
  const v2 = { levels: ["version", "family", "model"], preferOrigin: false } as const;
  const many = (count: number, overrides: Partial<EstimateSale>) =>
    Array.from({ length: count }, (_, n) =>
      sale({
        id: `${overrides.model ?? "x"}-${overrides.fipeCode ?? ""}-${overrides.origin ?? ""}-${n}`,
        ...overrides,
      }),
    );

  it("a mesma versão FIPE vem antes da família e do modelo", () => {
    const index = buildEstimateIndex([
      ...many(5, { fipeCode: "004450-1", finalBid: cents(4_000_000) }),
      ...many(5, { fipeCode: "004451-0", finalBid: cents(1_000_000) }),
    ]);
    expect(estimatePrice(target({ fipeCode: "004450-1" }), index, v2)).toMatchObject({
      kind: "comparables",
      level: "version",
      n: 5,
      median: 4_000_000,
    });
  });

  it("sem versão, a família separa o Onix Plus do Onix hatch; o v1 mistura os dois", () => {
    const index = buildEstimateIndex([
      ...many(5, { model: "ONIX PLUS LTZ", finalBid: cents(6_000_000) }),
      ...many(10, { model: "ONIX 10MT LT1", finalBid: cents(2_700_000) }),
    ]);
    expect(estimatePrice(target(), index, v2)).toMatchObject({ level: "family", n: 5, median: 6_000_000 });
    expect(estimatePrice(target(), index)).toMatchObject({ level: "model", n: 15 });
  });

  it("família com menos de 5 cai para o modelo; sem nenhum nível, diz o maior número achado", () => {
    const plus = many(3, { model: "ONIX PLUS LTZ" });
    const index = buildEstimateIndex([...plus, ...many(5, { model: "ONIX LT" })]);
    expect(findComparables(target(), index, v2)).toMatchObject({
      found: { level: "model", sameOrigin: false },
      largest: 8,
    });
    expect(findComparables(target(), buildEstimateIndex(plus), v2)).toEqual({ found: null, largest: 3 });
  });

  it("as vendas excluídas saem da conta", () => {
    const sales = many(5, { model: "ONIX PLUS" });
    const exclude = new Set([sales[0]?.id ?? ""]);
    expect(estimatePrice(target({ marketValue: null }), buildEstimateIndex(sales), { ...v2, exclude })).toEqual({
      kind: "insufficient",
      comparables: 4,
      needed: 5,
    });
  });

  it("com 5 vendas da mesma origem, a preferência por origem usa só elas", () => {
    const index = buildEstimateIndex([
      ...many(5, { model: "ONIX PLUS", origin: "financiamento", finalBid: cents(4_000_000) }),
      ...many(3, { model: "ONIX PLUS", origin: "orgao_publico", finalBid: cents(1_000_000) }),
    ]);
    const financed = target({ origin: "financiamento" });
    expect(estimatePrice(financed, index, { ...v2, preferOrigin: true })).toMatchObject({
      sameOrigin: true,
      n: 5,
      median: 4_000_000,
    });
    expect(estimatePrice(financed, index, v2)).toMatchObject({ sameOrigin: false, n: 8 });
    // Só 3 de órgão público: usa todas.
    expect(estimatePrice(target({ origin: "orgao_publico" }), index, { ...v2, preferOrigin: true })).toMatchObject({
      sameOrigin: false,
      n: 8,
    });
  });
});

describe("confidenceOf", () => {
  it("alta com 20 vendas ou mais e P25–P75 de até 40% da mediana", () => {
    expect(confidenceOf({ n: 20, spread: 0.4 })).toBe("high");
  });

  it("média com faixa estreita e menos vendas, ou com 20 vendas e faixa de até 60%", () => {
    expect(confidenceOf({ n: 19, spread: 0.4 })).toBe("medium");
    expect(confidenceOf({ n: 20, spread: 0.6 })).toBe("medium");
  });

  it("baixa com faixa larga", () => {
    expect(confidenceOf({ n: 19, spread: 0.41 })).toBe("low");
    expect(confidenceOf({ n: 50, spread: 0.61 })).toBe("low");
    expect(confidenceOf({ n: 50, spread: Number.POSITIVE_INFINITY })).toBe("low");
  });
});

describe("bandOf", () => {
  it("alarga a faixa com poucas vendas e converge para a P25–P75", () => {
    expect(bandOf([1, 2, 3, 4, 5])).toEqual({ low: 1.5, median: 3, high: 4.5 });
    const many = Array.from({ length: 101 }, (_, n) => n);
    const band = bandOf(many);
    expect(band.median).toBe(50);
    expect(band.low).toBeCloseTo(24.5, 1);
    expect(band.high).toBeCloseTo(75.5, 1);
  });

  it("nunca passa dos extremos", () => {
    expect(bandOf([1, 3])).toEqual({ low: 1, median: 2, high: 3 });
  });
});

describe("similarityOf", () => {
  it("mesma versão, ano, origem, km e condição somam mais", () => {
    const vehicle = target({ fipeCode: "004450-1", origin: "frota", mileageKm: 80_000 });
    expect(similarityOf(vehicle, sale({ fipeCode: "004450-1", origin: "frota" }))).toEqual({
      score: 8,
      reasons: ["same_version", "same_year", "same_origin", "close_mileage", "same_condition"],
    });
  });

  it("mesma família a um ano de distância", () => {
    expect(similarityOf(target({ mileageKm: null }), sale({ model: "ONIX PLUS LTZ", modelYear: 2021 }))).toEqual({
      score: 3,
      reasons: ["same_family", "year_apart", "same_condition"],
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
    riskReserveRateBps: null,
    desiredMargin: cents(800_000),
    desiredMarginRateBps: null,
    ...overrides,
  });
  const analysis = (overrides: Partial<AnalysisSample> = {}): AnalysisSample => ({
    brand: "Chevrolet",
    model: "Onix",
    modelYear: 2019,
    inputs: inputs(),
    ...overrides,
  });

  it("com 3 análises parecidas: calculadora com a mediana das premissas; reserva e margem em % da venda", () => {
    const estimate = estimateLimit(target(), [analysis(), analysis(), analysis({ modelYear: 2021 })], null);
    // Venda = FIPE 50.000 − 13% = 43.500. R = 4% (2.000/50.000) = 1.740; M = 16% = 6.960.
    // 43.500 − F 7.000 − 1.740 − 6.960 = 27.800 = L × 1,05 → L = 26.476,19
    expect(estimate).toEqual({ kind: "estimated", n: 3, maxBid: 2_647_619, marketValueFrom: "listing" });
  });

  it("comissão segue a modalidade da maioria: fixa com a mediana dos valores fixos", () => {
    const fixed = inputs({ commissionMode: "fixed", commissionRateBps: null, commissionFixed: cents(150_000) });
    const estimate = estimateLimit(
      target(),
      [analysis({ inputs: fixed }), analysis({ inputs: fixed }), analysis()],
      null,
    );
    // V 43.500 − F 7.000 − K 1.500 − R 1.740 − M 6.960 = 26.300
    expect(estimate).toEqual({ kind: "estimated", n: 3, maxBid: 2_630_000, marketValueFrom: "listing" });
  });

  it("valor de venda: FIPE do anúncio menos o desconto pela condição; sem ela, a mediana das análises", () => {
    const three = [analysis(), analysis(), analysis()];
    // FIPE 40.000 − 13% = 34.800; − F 7.000 − R 1.392 − M 5.568 = 20.840 = L × 1,05 → L = 19.847,62 (com a comissão arredondada)
    expect(estimateLimit(target({ marketValue: cents(4_000_000) }), three, null)).toEqual({
      kind: "estimated",
      n: 3,
      maxBid: 1_984_762,
      marketValueFrom: "listing",
    });
    // Média monta: FIPE 50.000 − 30% = 35.000; − 7.000 − 1.400 − 5.600 = 21.000 → L = 20.000
    expect(estimateLimit(target({ damageLevel: "medium" }), three, null)).toMatchObject({ maxBid: 2_000_000 });
    expect(estimateLimit(target({ marketValue: null }), three, null)).toEqual({
      kind: "estimated",
      n: 3,
      maxBid: 3_142_857,
      marketValueFrom: "analyses",
    });
  });

  it("análise incompleta não conta", () => {
    const incomplete = inputs({ desiredMargin: null });
    expect(estimateLimit(target(), [analysis(), analysis(), analysis({ inputs: incomplete })], null)).toEqual({
      kind: "insufficient",
      analyses: 2,
      needed: 3,
    });
  });

  it("modelo diferente ou ano fora da faixa não conta", () => {
    expect(
      estimateLimit(target(), [analysis(), analysis({ model: "Prisma" }), analysis({ modelYear: 2015 })], null),
    ).toEqual({ kind: "insufficient", analyses: 1, needed: 3 });
  });

  it("premissas sem lance viável: estimado, mas sem limite", () => {
    const expensive = inputs({ repairCost: cents(6_000_000) });
    expect(
      estimateLimit(
        target(),
        [analysis({ inputs: expensive }), analysis({ inputs: expensive }), analysis({ inputs: expensive })],
        null,
      ),
    ).toMatchObject({ kind: "estimated", n: 3, maxBid: null });
  });
});

describe("estimateLimit com premissas padrão (D-44)", () => {
  // FIPE 80.000 sem sinistro, sem nada do anúncio: o mesmo carro de src/domain/finance/defaults.test.ts.
  const listingDefaults = (overrides: Partial<DefaultsInput> = {}): DefaultsInput => ({
    fipe: cents(8_000_000),
    isMotorcycle: false,
    damageLevel: null,
    airbagDeployed: false,
    missingParts: false,
    dispatcherFee: null,
    removalFee: null,
    otherFees: null,
    commissionRate: null,
    distanceKm: null,
    ...overrides,
  });

  it("sem 3 análises parecidas: limite pelas premissas padrão do anúncio, com quantas análises havia", () => {
    // Venda 69.600; F = reparos 4.000 + doc 1.500 + guincho 1.500 + pneus 2.400 + revisão 1.500 = 10.900;
    // R 5% = 3.480; M 15% = 10.440. 69.600 − 10.900 − 3.480 − 10.440 = 44.780 = L × 1,05 → L = 42.647,62 (com a comissão arredondada)
    expect(estimateLimit(target(), [], listingDefaults())).toEqual({
      kind: "defaults",
      maxBid: 4_264_762,
      analyses: 0,
      needed: 3,
    });
  });

  it("com 3 análises parecidas, as análises têm precedência", () => {
    const analysis: AnalysisSample = {
      brand: "Chevrolet",
      model: "Onix",
      modelYear: 2020,
      inputs: {
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
        riskReserveRateBps: null,
        desiredMargin: cents(800_000),
        desiredMarginRateBps: null,
      },
    };
    expect(estimateLimit(target(), [analysis, analysis, analysis], listingDefaults())).toMatchObject({
      kind: "estimated",
      n: 3,
    });
  });

  it("sem FIPE ou sucata: sem limite", () => {
    expect(estimateLimit(target(), [], listingDefaults({ fipe: null }))).toEqual({
      kind: "insufficient",
      analyses: 0,
      needed: 3,
    });
    expect(estimateLimit(target(), [], listingDefaults({ damageLevel: "salvage" }))).toMatchObject({
      kind: "insufficient",
    });
  });

  it("premissas padrão sem lance viável: sem limite, mas pelas premissas padrão", () => {
    // Venda 1.000 (FIPE 1.150 − 13%, para baixo) não cobre os custos fixos.
    expect(estimateLimit(target(), [], listingDefaults({ fipe: cents(115_000) }))).toMatchObject({
      kind: "defaults",
      maxBid: null,
    });
  });

  it("limitMaxBid: o limite em reais quando existe", () => {
    expect(limitMaxBid({ kind: "defaults", maxBid: cents(100), analyses: 0, needed: 3 })).toBe(100);
    expect(limitMaxBid({ kind: "insufficient", analyses: 1, needed: 3 })).toBeNull();
  });
});

describe("limitFit", () => {
  const price: PriceEstimate = {
    kind: "comparables",
    level: "model",
    sameOrigin: false,
    confidence: "medium",
    saleIds: [],
    n: 8,
    median: cents(3_000_000),
    low: cents(2_500_000),
    high: cents(3_500_000),
  };

  it("folga quando até o P75 cabe; no limite quando só a mediana cabe; acima quando nem ela cabe", () => {
    expect(limitFit(price, cents(3_500_000))).toBe("comfortable");
    expect(limitFit(price, cents(3_000_000))).toBe("tight");
    expect(limitFit(price, cents(3_499_999))).toBe("tight");
    expect(limitFit(price, cents(2_999_999))).toBe("above");
  });

  it("sem provável ou sem limite viável: sem comparação", () => {
    expect(limitFit({ kind: "insufficient", comparables: 2, needed: 5 }, cents(3_000_000))).toBeNull();
    expect(limitFit(price, null)).toBeNull();
  });
});

describe("byAnalysisPriority", () => {
  const comparables: PriceEstimate = {
    kind: "comparables",
    level: "model",
    sameOrigin: false,
    confidence: "medium",
    saleIds: [],
    n: 6,
    median: cents(1),
    low: cents(1),
    high: cents(1),
  };
  const ratio: PriceEstimate = {
    kind: "market_ratio",
    confidence: "low",
    n: 40,
    median: cents(1),
    low: cents(1),
    high: cents(1),
    ratio: { median: 0.5, low: 0.4, high: 0.6 },
  };
  const day = (d: number) => new Date(Date.UTC(2026, 9, d, 12));
  const candidate = (name: string, overrides: Partial<AnalysisCandidate>) => ({
    name,
    price: comparables,
    fit: "comfortable" as const,
    endsAt: day(10),
    ...overrides,
  });

  it("comparáveis antes de proporção, folga antes de no limite e, depois, encerra primeiro (sem fim por último)", () => {
    const items = [
      candidate("proporção, folga, dia 9", { price: ratio, endsAt: day(9) }),
      candidate("comparáveis, no limite, dia 9", { fit: "tight", endsAt: day(9) }),
      candidate("comparáveis, folga, sem fim", { endsAt: null }),
      candidate("comparáveis, folga, dia 12", { endsAt: day(12) }),
      candidate("comparáveis, folga, dia 10", {}),
      candidate("comparáveis, folga, também sem fim", { endsAt: null }),
    ];
    expect(items.toSorted(byAnalysisPriority).map((item) => item.name)).toEqual([
      "comparáveis, folga, dia 10",
      "comparáveis, folga, dia 12",
      "comparáveis, folga, sem fim",
      "comparáveis, folga, também sem fim",
      "comparáveis, no limite, dia 9",
      "proporção, folga, dia 9",
    ]);
  });
});
