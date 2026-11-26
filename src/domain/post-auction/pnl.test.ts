import { describe, expect, it } from "vitest";

import type { AnalysisInputs } from "@/domain/finance/calculator";
import { bps, cents } from "@/domain/money";
import { calendarDateToUtc, toZonedDateInput } from "@/lib/dates";

import { calculateRealizedPnl, isPaymentOverdue, plannedBreakdownFromFixedAnalysis, summarizePortfolio } from "./pnl";

const reais = (value: number) => cents(Math.round(value * 100));

const fixedInputs: AnalysisInputs = {
  marketValue: reais(50_000),
  repairCost: reais(4_000),
  documentationCost: reais(1_500),
  transportCost: reais(800),
  tiresCost: reais(1_200),
  serviceCost: reais(1_000),
  otherFees: reais(500),
  debtsCost: reais(600),
  sellingCost: reais(400),
  taxCost: reais(300),
  commissionMode: "percentage",
  commissionFixed: null,
  commissionRateBps: bps(500),
  riskReserve: reais(2_500),
  riskReserveRateBps: null,
  desiredMargin: reais(7_500),
  desiredMarginRateBps: null,
};

describe("plannedBreakdownFromFixedAnalysis", () => {
  it("converte análise v3 para o previsto no lance final pago", () => {
    const planned = plannedBreakdownFromFixedAnalysis(fixedInputs, 3, reais(30_000));
    expect(planned).not.toBeNull();
    expect(planned?.expectedSalePrice).toBe(reais(50_000));
    expect(planned?.riskReserve).toBe(reais(2_500));
    expect(planned?.byCategory.auction_commission).toBe(reais(1_500)); // 5% de 30.000
    expect(planned?.byCategory.repair).toBe(reais(4_000));
    expect(planned?.byCategory.debts).toBe(reais(600));
    expect(planned?.byCategory.selling).toBe(reais(400));
    expect(planned?.byCategory.tax).toBe(reais(300));
  });

  it("normaliza análises legadas (v2) sem os novos campos v3", () => {
    const legacy = { ...fixedInputs, debtsCost: null, sellingCost: null, taxCost: null };
    const planned = plannedBreakdownFromFixedAnalysis(legacy, 2, reais(30_000));
    expect(planned).not.toBeNull();
    expect(planned?.byCategory.debts).toBe(0);
    expect(planned?.byCategory.selling).toBe(0);
    expect(planned?.byCategory.tax).toBe(0);
  });

  it("retorna null quando a análise está incompleta", () => {
    expect(plannedBreakdownFromFixedAnalysis({ ...fixedInputs, repairCost: null }, 3, reais(30_000))).toBeNull();
  });
});

describe("calculateRealizedPnl", () => {
  const now = new Date("2026-11-26T12:00:00Z");

  it("calcula P&L completo de lote vendido e desvio por categoria frente ao previsto", () => {
    const planned = plannedBreakdownFromFixedAnalysis(fixedInputs, 3, reais(30_000));
    const pnl = calculateRealizedPnl({
      finalBid: reais(30_000),
      expenses: [
        { category: "auction_commission", amount: reais(1_500) },
        { category: "auction_fees", amount: reais(500) },
        { category: "debts", amount: reais(600) },
        { category: "transport", amount: reais(900) },
        { category: "documentation", amount: reais(1_500) },
        { category: "repair", amount: reais(5_000) },
        { category: "tires", amount: reais(1_000) },
        { category: "service", amount: reais(1_000) },
        { category: "selling", amount: reais(400) },
        { category: "tax", amount: reais(300) },
      ],
      salePrice: reais(51_000),
      planned,
      acquiredAt: new Date("2026-10-01T00:00:00Z"),
      listedAt: new Date("2026-10-21T00:00:00Z"),
      soldAt: new Date("2026-10-31T00:00:00Z"),
      now,
    });

    // Despesas reais = 12.700; total investido = 42.700; previsto sem reserva = 30.000 + 11.800 = 41.800
    expect(pnl.totalExpenses).toBe(reais(12_700));
    expect(pnl.totalInvested).toBe(reais(42_700));
    expect(pnl.plannedTotalWithoutReserve).toBe(reais(41_800));
    expect(pnl.plannedTotalWithReserve).toBe(reais(44_300));
    expect(pnl.costVariance).toBe(reais(900));
    expect(pnl.realizedProfit).toBe(reais(8_300));
    expect(pnl.realizedMarginRatio).toBeCloseTo(8_300 / 51_000, 6);
    expect(pnl.realizedRoiRatio).toBeCloseTo(8_300 / 42_700, 6);
    expect(pnl.holdDays).toBe(30);
    expect(pnl.prepDays).toBe(20);
    expect(pnl.saleDays).toBe(10);
    expect(pnl.monthlyRoiRatio).toBeCloseTo(8_300 / 42_700, 6);

    const repairRow = pnl.byCategory.find((row) => row.category === "repair");
    expect(repairRow).toEqual({
      category: "repair",
      planned: reais(4_000),
      actual: reais(5_000),
      variance: reais(1_000),
      varianceRatio: 0.25,
    });
  });

  it("funciona sem análise fixada e em lote ainda não vendido", () => {
    const pnl = calculateRealizedPnl({
      finalBid: reais(20_000),
      expenses: [{ category: "repair", amount: reais(2_000) }],
      salePrice: null,
      planned: null,
      acquiredAt: new Date("2026-11-16T00:00:00Z"),
      listedAt: null,
      soldAt: null,
      now,
    });

    expect(pnl.totalInvested).toBe(reais(22_000));
    expect(pnl.plannedTotalWithoutReserve).toBeNull();
    expect(pnl.costVariance).toBeNull();
    expect(pnl.realizedProfit).toBeNull();
    expect(pnl.monthlyRoiRatio).toBeNull();
    expect(pnl.holdDays).toBe(10);
    expect(pnl.byCategory).toEqual([
      { category: "repair", planned: null, actual: reais(2_000), variance: null, varianceRatio: null },
    ]);
  });

  it("calcula prejuízo líquido com margens e ROI negativos", () => {
    const pnl = calculateRealizedPnl({
      finalBid: reais(30_000),
      expenses: [{ category: "repair", amount: reais(10_000) }],
      salePrice: reais(36_000),
      planned: null,
      acquiredAt: new Date("2026-10-01T00:00:00Z"),
      listedAt: new Date("2026-10-15T00:00:00Z"),
      soldAt: new Date("2026-10-31T00:00:00Z"),
      now,
    });

    expect(pnl.totalInvested).toBe(reais(40_000));
    expect(pnl.realizedProfit).toBe(reais(-4_000));
    expect(pnl.realizedMarginRatio).toBeCloseTo(-4_000 / 36_000, 6);
    expect(pnl.realizedRoiRatio).toBeCloseTo(-0.1, 6);
    expect(pnl.holdDays).toBe(30);
    expect(pnl.monthlyRoiRatio).toBeCloseTo(-0.1, 6);
  });

  it("venda no mesmo dia retorna holdDays = 0 e monthlyRoiRatio = null", () => {
    const pnl = calculateRealizedPnl({
      finalBid: reais(20_000),
      expenses: [],
      salePrice: reais(25_000),
      planned: null,
      acquiredAt: new Date("2026-11-20T00:00:00Z"),
      listedAt: new Date("2026-11-20T00:00:00Z"),
      soldAt: new Date("2026-11-20T00:00:00Z"),
      now,
    });

    expect(pnl.holdDays).toBe(0);
    expect(pnl.realizedProfit).toBe(reais(5_000));
    expect(pnl.realizedRoiRatio).toBeCloseTo(0.25, 6);
    expect(pnl.monthlyRoiRatio).toBeNull();
  });
});

describe("isPaymentOverdue e summarizePortfolio", () => {
  const today = new Date("2026-11-26T00:00:00Z");

  it("detecta pagamento vencido apenas quando prazo passou e não há data de pagamento", () => {
    expect(isPaymentOverdue(new Date("2026-11-25T00:00:00Z"), null, today)).toBe(true);
    expect(isPaymentOverdue(new Date("2026-11-26T00:00:00Z"), null, today)).toBe(false);
    expect(isPaymentOverdue(new Date("2026-11-25T00:00:00Z"), new Date("2026-11-25T00:00:00Z"), today)).toBe(false);
    expect(isPaymentOverdue(null, null, today)).toBe(false);

    // 22:30 em Brasília (26/11) = 01:30 UTC de 27/11; normalizado no fuso do app não vence antes da meia-noite BRT.
    const lateEveningBrt = new Date("2026-11-27T01:30:00Z");
    const appToday = calendarDateToUtc(toZonedDateInput(lateEveningBrt)) ?? today;
    expect(isPaymentOverdue(new Date("2026-11-26T00:00:00Z"), null, appToday)).toBe(false);
  });

  it("consolida capital imobilizado, lucro realizado, ROI ponderado e giro mediano", () => {
    const summary = summarizePortfolio(
      [
        {
          status: "in_repair",
          paymentDueAt: new Date("2026-11-20T00:00:00Z"),
          paidAt: null,
          salePrice: null,
          pnl: { totalInvested: reais(35_000), realizedProfit: null, holdDays: 12 },
        },
        {
          status: "sold",
          paymentDueAt: new Date("2026-10-05T00:00:00Z"),
          paidAt: new Date("2026-10-04T00:00:00Z"),
          salePrice: reais(50_000),
          pnl: { totalInvested: reais(40_000), realizedProfit: reais(10_000), holdDays: 30 },
        },
        {
          status: "sold",
          paymentDueAt: null,
          paidAt: null,
          salePrice: reais(65_000),
          pnl: { totalInvested: reais(60_000), realizedProfit: reais(5_000), holdDays: 50 },
        },
      ],
      today,
    );

    expect(summary).toEqual({
      totalLots: 3,
      inProgressCount: 1,
      soldCount: 2,
      capitalDeployed: reais(35_000),
      totalRealizedProfit: reais(15_000),
      totalSoldInvested: reais(100_000),
      totalSoldRevenue: reais(115_000),
      averageRoiRatio: 0.15,
      medianHoldDays: 40,
      overduePaymentCount: 1,
    });
  });

  it("carteira vazia retorna zeros e razões nulas", () => {
    expect(summarizePortfolio([], today)).toEqual({
      totalLots: 0,
      inProgressCount: 0,
      soldCount: 0,
      capitalDeployed: 0,
      totalRealizedProfit: 0,
      totalSoldInvested: 0,
      totalSoldRevenue: 0,
      averageRoiRatio: null,
      medianHoldDays: null,
      overduePaymentCount: 0,
    });
  });
});
