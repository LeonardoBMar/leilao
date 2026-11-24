import { describe, expect, it } from "vitest";

import { bps, cents } from "../money";
import {
  DEFAULT_COSTS,
  DEFAULT_DRAFT_NOTES_PREFIX,
  defaultAssumptions,
  defaultInputs,
  defaultMaxBid,
  type DefaultsInput,
  estimateFromFipe,
  isUnreviewedDefaultDraft,
  towCost,
  type UserDefaultOverrides,
} from "./defaults";

const reais = (value: number) => cents(Math.round(value * 100));

const car = (overrides: Partial<DefaultsInput> = {}): DefaultsInput => ({
  fipe: reais(80_000),
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

describe("estimateFromFipe", () => {
  it.each([
    [null, 69_600, 4_000],
    ["small", 64_000, 12_000],
    ["medium", 56_000, 24_000],
    ["large", 48_000, 40_000],
  ] as const)("condição %s: venda %d e reparos %d", (damageLevel, sale, repair) => {
    expect(estimateFromFipe(car({ damageLevel }))).toMatchObject({
      marketValue: reais(sale),
      repairCost: reais(repair),
    });
  });

  it("venda arredonda para baixo e reparos para cima, a R$ 100 (pessimista)", () => {
    expect(estimateFromFipe(car({ fipe: reais(52_918) }))).toMatchObject({
      marketValue: reais(46_000), // 46.038,66
      repairCost: reais(2_700), // 2.645,90
    });
  });

  it("reparos têm piso (carro R$ 2.000, moto R$ 800) e acréscimos por airbag e peças faltando", () => {
    expect(estimateFromFipe(car({ fipe: reais(20_000) })).repairCost).toBe(reais(2_000));
    expect(estimateFromFipe(car({ fipe: reais(10_000), isMotorcycle: true })).repairCost).toBe(reais(800));
    expect(estimateFromFipe(car({ airbagDeployed: true, missingParts: true })).repairCost).toBe(reais(15_000));
  });

  it("sucata ou sem FIPE: nada estimado", () => {
    expect(estimateFromFipe(car({ damageLevel: "salvage" }))).toMatchObject({ marketValue: null, repairCost: null });
    expect(estimateFromFipe(car({ fipe: null }))).toMatchObject({ marketValue: null, repairCost: null });
  });
});

describe("towCost", () => {
  it("R$ 300 + R$ 6 por km de estrada (linha reta × 1,3), arredondado a R$ 10 para cima", () => {
    expect(towCost(100)).toEqual({ cost: reais(1_080), roadKm: 130 });
    expect(towCost(0)).toEqual({ cost: reais(300), roadKm: 0 });
  });
});

describe("defaultAssumptions", () => {
  it("sem nada do anúncio: padrões de carro, comissão 5%, reserva 5% e margem 15%", () => {
    expect(defaultAssumptions(car())).toMatchObject({
      marketValue: reais(69_600),
      repairCost: reais(4_000),
      documentationCost: DEFAULT_COSTS.documentation,
      transportCost: DEFAULT_COSTS.towUnknownDistance,
      tiresCost: reais(2_400),
      serviceCost: reais(1_500),
      otherFees: cents(0),
      commissionRateBps: bps(500),
      riskReserveRateBps: bps(500),
      desiredMarginRateBps: bps(1_500),
      basis: { transport: "unknown_distance", documentation: "default", commission: "default", otherFees: "default" },
    });
  });

  it("o que o anúncio informa tem precedência; com local, guincho pela distância", () => {
    const fromListing = defaultAssumptions(
      car({ dispatcherFee: cents(0), removalFee: reais(550), otherFees: reais(2_600), commissionRate: bps(600) }),
    );
    expect(fromListing).toMatchObject({
      documentationCost: cents(0),
      transportCost: reais(550),
      otherFees: reais(2_600),
      commissionRateBps: bps(600),
      basis: { transport: "listing", roadKm: null },
    });
    expect(defaultAssumptions(car({ distanceKm: 100 }))).toMatchObject({
      transportCost: reais(1_080),
      basis: { transport: "distance", roadKm: 130 },
    });
  });

  it("moto: pneus e revisão de moto", () => {
    expect(defaultAssumptions(car({ isMotorcycle: true }))).toMatchObject({
      tiresCost: reais(900),
      serviceCost: reais(600),
    });
  });
});

describe("defaultMaxBid", () => {
  it("calculadora com as premissas padrão: a mesma conta do rascunho (D-44)", () => {
    // Venda 69.600 − F 10.900 − R 3.480 − M 10.440 = 44.780 = L × 1,05 → L = 42.647,62
    expect(defaultMaxBid(car())).toMatchObject({ kind: "viable", maxBid: reais(42_647.62) });
  });

  it("sem FIPE ou sucata: incompleto (sem valor de venda nem reparos)", () => {
    expect(defaultMaxBid(car({ fipe: null })).kind).toBe("incomplete");
    expect(defaultMaxBid(car({ damageLevel: "salvage" })).kind).toBe("incomplete");
  });
});

describe("UserDefaultOverrides", () => {
  const overrides: UserDefaultOverrides = {
    desiredMarginRateBps: bps(2_000),
    riskReserveRateBps: bps(800),
    documentationCost: reais(2_000),
    towBase: reais(400),
    towPerKm: reais(8),
    towUnknownDistance: reais(2_200),
    saleDiscountNoneBps: bps(1_000),
    saleDiscountSmallBps: bps(1_800),
    saleDiscountMediumBps: bps(2_800),
    saleDiscountLargeBps: bps(4_500),
  };

  it("estimateFromFipe aplica descontos por monta sobrescritos e mantém fallback nos nulos", () => {
    expect(estimateFromFipe(car({ damageLevel: null }), overrides)).toMatchObject({
      marketValue: reais(72_000),
      saleDiscount: bps(1_000),
    });
    expect(estimateFromFipe(car({ damageLevel: "small" }), overrides)).toMatchObject({
      marketValue: reais(65_600),
      saleDiscount: bps(1_800),
    });
    expect(estimateFromFipe(car({ damageLevel: "medium" }), overrides)).toMatchObject({
      marketValue: reais(57_600),
      saleDiscount: bps(2_800),
    });
    expect(estimateFromFipe(car({ damageLevel: "large" }), overrides)).toMatchObject({
      marketValue: reais(44_000),
      saleDiscount: bps(4_500),
    });
    expect(estimateFromFipe(car({ damageLevel: "small" }), { saleDiscountSmallBps: null })).toEqual(
      estimateFromFipe(car({ damageLevel: "small" })),
    );
  });

  it("towCost aplica saída e valor por km sobrescritos", () => {
    // 100 km linha reta -> 130 km estrada; 400 + 8 * 130 = 1.440
    expect(towCost(100, overrides)).toEqual({ cost: reais(1_440), roadKm: 130 });
    expect(towCost(100, { towBase: null, towPerKm: null })).toEqual(towCost(100));
  });

  it("defaultAssumptions, defaultInputs e defaultMaxBid respeitam overrides sem sobrescrever o anúncio", () => {
    const custom = defaultAssumptions(car(), overrides);
    expect(custom).toMatchObject({
      marketValue: reais(72_000),
      documentationCost: reais(2_000),
      transportCost: reais(2_200),
      riskReserveRateBps: bps(800),
      desiredMarginRateBps: bps(2_000),
    });

    // Valores vindos do anúncio ainda têm precedência sobre as preferências
    const withListingFees = defaultAssumptions(car({ dispatcherFee: reais(900), removalFee: reais(600) }), overrides);
    expect(withListingFees).toMatchObject({
      documentationCost: reais(900),
      transportCost: reais(600),
    });

    expect(defaultInputs(car(), overrides)).toMatchObject({
      marketValue: reais(72_000),
      documentationCost: reais(2_000),
      transportCost: reais(2_200),
      riskReserveRateBps: bps(800),
      desiredMarginRateBps: bps(2_000),
    });

    expect(defaultMaxBid(car(), overrides)).not.toEqual(defaultMaxBid(car()));
    expect(defaultMaxBid(car(), {})).toEqual(defaultMaxBid(car()));
  });
});

describe("isUnreviewedDefaultDraft", () => {
  const createdAt = new Date("2026-10-01T12:00:00Z");
  const defaultNotes = `${DEFAULT_DRAFT_NOTES_PREFIX} (revise antes de fixar):\n- exemplo`;

  it("marca verdadeiro quando as notas são padrão e nunca foi editado", () => {
    expect(isUnreviewedDefaultDraft({ createdAt, updatedAt: createdAt, notes: defaultNotes })).toBe(true);
  });

  it("marca falso quando foi editado depois da criação ou teve notas alteradas", () => {
    const updatedAt = new Date("2026-10-01T12:05:00Z");
    expect(isUnreviewedDefaultDraft({ createdAt, updatedAt, notes: defaultNotes })).toBe(false);
    expect(isUnreviewedDefaultDraft({ createdAt, updatedAt: createdAt, notes: "Revisado manualmente." })).toBe(false);
    expect(isUnreviewedDefaultDraft({ createdAt, updatedAt: createdAt, notes: null })).toBe(false);
  });
});
