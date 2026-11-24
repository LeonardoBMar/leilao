import { describe, expect, it } from "vitest";

import { cents } from "../money";
import type { BacktestOutcome, BacktestSale } from "./backtest";
import {
  buildEngineQualityReport,
  DEFAULT_ENGINE_QUALITY_FROM,
  ENGINE_QUALITY_REFRESH_INTERVAL_MS,
  ENGINE_QUALITY_TARGET_WINDOW_MS,
  ENGINE_QUALITY_VERSION,
  engineQualityWindowStart,
  isEngineQualityStale,
  parseEngineQualityReport,
  serializeEngineQualityReport,
} from "./engine-quality";

function makeSale(finalBidCents: number): BacktestSale {
  return {
    id: `sale-${finalBidCents}`,
    endsAt: new Date("2026-10-10T15:00:00.000Z"),
    brand: "FIAT",
    model: "ARGO",
    modelYear: 2022,
    mileageKm: 50_000,
    category: "car",
    damageLevel: null,
    fipeCode: null,
    origin: "financiamento",
    finalBid: cents(finalBidCents),
    marketValue: cents(60_000_00),
  };
}

describe("buildEngineQualityReport", () => {
  it("resume total e níveis de confiança presentes, ignorando insuficientes no mapa por confiança", () => {
    const outcomes: BacktestOutcome[] = [
      {
        sale: makeSale(40_000_00),
        estimate: {
          kind: "comparables",
          level: "model",
          sameOrigin: false,
          low: cents(38_000_00),
          median: cents(40_000_00),
          high: cents(42_000_00),
          n: 20,
          saleIds: [],
          confidence: "high",
        },
      },
      {
        sale: makeSale(50_000_00),
        estimate: {
          kind: "comparables",
          level: "model",
          sameOrigin: false,
          low: cents(35_000_00),
          median: cents(40_000_00),
          high: cents(45_000_00),
          n: 6,
          saleIds: [],
          confidence: "low",
        },
      },
      {
        sale: makeSale(45_000_00),
        estimate: { kind: "insufficient", comparables: 2, needed: 5 },
      },
    ];

    const computedAt = new Date("2026-11-24T12:00:00.000Z");
    const from = new Date("2026-09-15T03:00:00.000Z");
    const report = buildEngineQualityReport(outcomes, { computedAt, from });

    expect(report.version).toBe(ENGINE_QUALITY_VERSION);
    expect(report.computedAt).toEqual(computedAt);
    expect(report.from).toEqual(from);
    expect(report.total).toEqual({
      total: 3,
      estimated: 2,
      hitRate: 0.5,
      medianAbsError: 0.1,
    });
    expect(report.byConfidence.high).toEqual({
      total: 1,
      estimated: 1,
      hitRate: 1,
      medianAbsError: 0,
    });
    expect(report.byConfidence.low).toEqual({
      total: 1,
      estimated: 1,
      hitRate: 0,
      medianAbsError: 0.2,
    });
    expect(report.byConfidence.medium).toBeUndefined();
  });

  it("lida com lista vazia devolvendo métricas nulas", () => {
    const report = buildEngineQualityReport([], {
      computedAt: new Date("2026-11-24T12:00:00.000Z"),
      from: new Date("2026-09-15T03:00:00.000Z"),
    });

    expect(report.total).toEqual({
      total: 0,
      estimated: 0,
      hitRate: null,
      medianAbsError: null,
    });
    expect(report.byConfidence).toEqual({});
  });
});

describe("parseEngineQualityReport", () => {
  it("faz roundtrip a partir do formato serializado", () => {
    const report = buildEngineQualityReport([], {
      computedAt: new Date("2026-11-24T12:00:00.000Z"),
      from: new Date("2026-09-15T03:00:00.000Z"),
    });
    const serialized = serializeEngineQualityReport(report);
    const parsed = parseEngineQualityReport(serialized);

    expect(parsed).toEqual(report);
  });

  it("retorna null para versão desconhecida ou payload inválido", () => {
    expect(parseEngineQualityReport({ version: 2 })).toBeNull();
    expect(parseEngineQualityReport(null)).toBeNull();
    expect(
      parseEngineQualityReport({
        version: ENGINE_QUALITY_VERSION,
        computedAt: "data-invalida",
        from: "2026-09-15T03:00:00.000Z",
        total: { total: 10, estimated: 5, hitRate: 0.5, medianAbsError: 0.2 },
        byConfidence: {},
      }),
    ).toBeNull();
    expect(
      parseEngineQualityReport({
        version: ENGINE_QUALITY_VERSION,
        computedAt: "2026-11-24T12:00:00.000Z",
        from: "2026-09-15T03:00:00.000Z",
        total: { total: 10, estimated: 5, hitRate: 1.5, medianAbsError: 0.2 },
        byConfidence: {},
      }),
    ).toBeNull();
  });
});

describe("isEngineQualityStale", () => {
  const now = new Date("2026-11-24T12:00:00.000Z");

  it("considera desatualizado quando não há snapshot anterior", () => {
    expect(isEngineQualityStale(null, now)).toBe(true);
  });

  it("não vence antes de completar 7 dias", () => {
    const justUnderSevenDays = new Date(now.getTime() - ENGINE_QUALITY_REFRESH_INTERVAL_MS + 1);
    expect(isEngineQualityStale(justUnderSevenDays, now)).toBe(false);
  });

  it("vence exatamente ao completar 7 dias ou depois", () => {
    const exactlySevenDays = new Date(now.getTime() - ENGINE_QUALITY_REFRESH_INTERVAL_MS);
    const eightDaysAgo = new Date(now.getTime() - ENGINE_QUALITY_REFRESH_INTERVAL_MS - 24 * 60 * 60 * 1000);
    expect(isEngineQualityStale(exactlySevenDays, now)).toBe(true);
    expect(isEngineQualityStale(eightDaysAgo, now)).toBe(true);
  });
});

describe("engineQualityWindowStart", () => {
  it("mantém DEFAULT_ENGINE_QUALITY_FROM quando ainda não passaram 180 dias", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    expect(engineQualityWindowStart(now)).toEqual(DEFAULT_ENGINE_QUALITY_FROM);
  });

  it("avança a janela móvel para 180 dias antes de now quando o histórico ultrapassa a janela", () => {
    const now = new Date("2027-06-01T12:00:00.000Z");
    expect(engineQualityWindowStart(now)).toEqual(new Date(now.getTime() - ENGINE_QUALITY_TARGET_WINDOW_MS));
  });
});
