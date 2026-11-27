import { describe, expect, it } from "vitest";

import { bps, cents } from "@/domain/money";
import type { ExpenseCategory } from "@/domain/post-auction/pnl";

import {
  type CostCalibrationLotInput,
  mergeSuggestionPatches,
  MIN_COST_CALIBRATION_LOTS,
  summarizeCostCalibration,
} from "./cost-calibration";

const reais = (value: number) => cents(Math.round(value * 100));

function zeroByCategory(
  overrides: Partial<Record<ExpenseCategory, number>> = {},
): Record<ExpenseCategory, ReturnType<typeof cents>> {
  return {
    auction_commission: reais(overrides.auction_commission ?? 0),
    auction_fees: reais(overrides.auction_fees ?? 0),
    debts: reais(overrides.debts ?? 0),
    transport: reais(overrides.transport ?? 0),
    documentation: reais(overrides.documentation ?? 0),
    repair: reais(overrides.repair ?? 0),
    tires: reais(overrides.tires ?? 0),
    service: reais(overrides.service ?? 0),
    selling: reais(overrides.selling ?? 0),
    tax: reais(overrides.tax ?? 0),
    other: reais(overrides.other ?? 0),
  };
}

function makeLot(
  id: string,
  opts: {
    expectedSale: number;
    actualSale: number;
    plannedTotal: number;
    actualTotal: number;
    docPlanned?: number;
    docActual?: number;
    repairPlanned?: number;
    repairActual?: number;
    holdDays?: number;
  },
): CostCalibrationLotInput {
  return {
    lotId: id,
    label: `Lote ${id}`,
    soldAt: new Date("2026-11-20T00:00:00Z"),
    expectedSalePrice: reais(opts.expectedSale),
    actualSalePrice: reais(opts.actualSale),
    plannedTotalWithoutReserve: reais(opts.plannedTotal),
    actualTotalInvested: reais(opts.actualTotal),
    expectedProfitAtBid: reais(opts.expectedSale - opts.plannedTotal),
    realizedProfit: reais(opts.actualSale - opts.actualTotal),
    holdDays: opts.holdDays ?? 30,
    plannedByCategory: zeroByCategory({
      documentation: opts.docPlanned ?? 1_500,
      repair: opts.repairPlanned ?? 4_000,
    }),
    actualByCategory: zeroByCategory({
      documentation: opts.docActual ?? 1_500,
      repair: opts.repairActual ?? 4_000,
    }),
  };
}

describe("summarizeCostCalibration", () => {
  it("retorna resumo vazio quando não há lotes vendidos", () => {
    const summary = summarizeCostCalibration([]);
    expect(summary.n).toBe(0);
    expect(summary.hasMinimumSample).toBe(false);
    expect(summary.byCategory).toEqual([]);
    expect(summary.suggestions).toEqual([]);
    expect(summary.salePriceBias.medianBiasRatio).toBeNull();
    expect(summary.medianHoldDays).toBeNull();
  });

  it("calcula vieses mesmo abaixo da amostra mínima, mas não sugere ajustes em preferências", () => {
    const lots = [
      makeLot("1", {
        expectedSale: 50_000,
        actualSale: 47_500,
        plannedTotal: 40_000,
        actualTotal: 42_000,
        repairPlanned: 4_000,
        repairActual: 5_000,
      }),
    ];
    const summary = summarizeCostCalibration(lots);
    expect(summary.n).toBe(1);
    expect(summary.hasMinimumSample).toBe(false);
    expect(summary.suggestions).toEqual([]);
    expect(summary.salePriceBias.medianBiasRatio).toBeCloseTo(-0.05, 6);
    const repair = summary.byCategory.find((row) => row.category === "repair");
    expect(repair?.medianBiasRatio).toBeCloseTo(0.25, 6);
  });

  it("gera sugestões de documentação, reserva de risco e desconto de revenda com n >= 3", () => {
    const lots = [
      makeLot("1", {
        expectedSale: 50_000,
        actualSale: 48_000, // -4%
        plannedTotal: 40_000,
        actualTotal: 43_200, // +8%
        docPlanned: 1_500,
        docActual: 2_100,
        repairPlanned: 4_000,
        repairActual: 5_200,
        holdDays: 25,
      }),
      makeLot("2", {
        expectedSale: 60_000,
        actualSale: 57_600, // -4%
        plannedTotal: 45_000,
        actualTotal: 48_600, // +8%
        docPlanned: 1_500,
        docActual: 2_200,
        repairPlanned: 5_000,
        repairActual: 6_000,
        holdDays: 35,
      }),
      makeLot("3", {
        expectedSale: 70_000,
        actualSale: 67_200, // -4%
        plannedTotal: 50_000,
        actualTotal: 54_000, // +8%
        docPlanned: 1_500,
        docActual: 2_200,
        repairPlanned: 6_000,
        repairActual: 7_500,
        holdDays: 40,
      }),
    ];

    expect(lots.length).toBeGreaterThanOrEqual(MIN_COST_CALIBRATION_LOTS);
    const summary = summarizeCostCalibration(lots);

    expect(summary.hasMinimumSample).toBe(true);
    expect(summary.medianHoldDays).toBe(35);
    expect(summary.medianCostVarianceRatio).toBeCloseTo(0.08, 6);
    expect(summary.salePriceBias.medianBiasRatio).toBeCloseTo(-0.04, 6);

    const ids = summary.suggestions.map((item) => item.id);
    expect(ids).toEqual(["documentation", "risk_reserve", "sale_discounts"]);

    const merged = mergeSuggestionPatches(summary.suggestions);
    expect(merged.documentationCost).toBe(reais(2_200));
    expect(merged.riskReserveRateBps).toBe(bps(800));
    // Desconto padrão sobe +4% (400 bps) sobre os descontos originais (13/20/30/40% -> 17/24/34/44%)
    expect(merged.saleDiscountNoneBps).toBe(bps(1_700));
    expect(merged.saleDiscountSmallBps).toBe(bps(2_400));
    expect(merged.saleDiscountMediumBps).toBe(bps(3_400));
    expect(merged.saleDiscountLargeBps).toBe(bps(4_400));

    // Idempotência: após aplicar o patch sugerido nas preferências, nenhuma sugestão deve reaparecer.
    const afterApply = summarizeCostCalibration(lots, merged);
    expect(afterApply.suggestions).toEqual([]);
  });

  it("reduz o desconto sugerido quando as vendas reais superam o valor esperado e respeita limites 0..8000 bps", () => {
    const lots = [
      makeLot("1", { expectedSale: 50_000, actualSale: 52_500, plannedTotal: 40_000, actualTotal: 40_000 }),
      makeLot("2", { expectedSale: 60_000, actualSale: 63_000, plannedTotal: 45_000, actualTotal: 45_000 }),
      makeLot("3", { expectedSale: 70_000, actualSale: 73_500, plannedTotal: 50_000, actualTotal: 50_000 }),
    ];
    const summary = summarizeCostCalibration(lots);
    const saleSuggestion = summary.suggestions.find((item) => item.id === "sale_discounts");
    expect(saleSuggestion?.patch.saleDiscountNoneBps).toBe(bps(800)); // 13% - 5% = 8%

    // Saturação em 0 bps quando o viés positivo supera o desconto padrão
    const extremeUp = [
      makeLot("1", { expectedSale: 50_000, actualSale: 75_000, plannedTotal: 40_000, actualTotal: 40_000 }),
      makeLot("2", { expectedSale: 60_000, actualSale: 90_000, plannedTotal: 45_000, actualTotal: 45_000 }),
      makeLot("3", { expectedSale: 70_000, actualSale: 105_000, plannedTotal: 50_000, actualTotal: 50_000 }),
    ];
    const clamped = summarizeCostCalibration(extremeUp);
    const clampedSale = clamped.suggestions.find((item) => item.id === "sale_discounts");
    expect(clampedSale?.patch.saleDiscountNoneBps).toBe(bps(0));
    expect(summarizeCostCalibration(extremeUp, clampedSale?.patch).suggestions).toEqual([]);
  });
});
