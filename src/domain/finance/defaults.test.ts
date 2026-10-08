import { describe, expect, it } from "vitest";

import { bps, cents } from "../money";
import {
  DEFAULT_COSTS,
  defaultAssumptions,
  defaultMaxBid,
  type DefaultsInput,
  estimateFromFipe,
  towCost,
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
