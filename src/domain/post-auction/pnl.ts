import { type AnalysisInputs, commissionFor, completeInputs, normalizeLegacyInputs } from "@/domain/finance/calculator";
import { type Cents, cents, sumCents } from "@/domain/money";

/**
 * Regras puras do pós-arremate (D-96): P&L realizado, desvio previsto × realizado por categoria,
 * tempo de giro e resumo consolidado da carteira de veículos arrematados.
 */

export const POST_AUCTION_STATUSES = [
  "acquired",
  "in_transit",
  "in_repair",
  "ready_for_sale",
  "listed",
  "sold",
] as const;
export type PostAuctionStatus = (typeof POST_AUCTION_STATUSES)[number];

export const EXPENSE_CATEGORIES = [
  "auction_commission",
  "auction_fees",
  "debts",
  "transport",
  "documentation",
  "repair",
  "tires",
  "service",
  "selling",
  "tax",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseEntry = {
  category: ExpenseCategory;
  amount: Cents;
};

/** Custos previstos na análise fixada vinculada ao arremate, já avaliados no preço final pago. */
export type PlannedCostBreakdown = {
  expectedSalePrice: Cents;
  riskReserve: Cents;
  byCategory: Record<ExpenseCategory, Cents>;
};

export type CategoryVariance = {
  category: ExpenseCategory;
  planned: Cents | null;
  actual: Cents;
  /** `actual − planned`: positivo = gastou acima do previsto; negativo = economizou. */
  variance: Cents | null;
  /** `(actual − planned) / planned` quando `planned > 0`. */
  varianceRatio: number | null;
};

export type RealizedPnlInput = {
  finalBid: Cents;
  expenses: readonly ExpenseEntry[];
  salePrice: Cents | null;
  planned: PlannedCostBreakdown | null;
  acquiredAt: Date | null;
  listedAt: Date | null;
  soldAt: Date | null;
  now: Date;
};

export type RealizedPnl = {
  finalBid: Cents;
  totalExpenses: Cents;
  /** `finalBid + totalExpenses`. */
  totalInvested: Cents;
  /** Custo total previsto no lance final (sem reserva de risco), quando há análise fixada. */
  plannedTotalWithoutReserve: Cents | null;
  /** Custo total previsto no lance final (incluindo reserva de risco), quando há análise fixada. */
  plannedTotalWithReserve: Cents | null;
  /** `totalInvested − plannedTotalWithoutReserve`: positivo = gastou mais que o previsto. */
  costVariance: Cents | null;
  /** Desvio por categoria com valor previsto ou gasto real > 0. */
  byCategory: CategoryVariance[];
  /** `salePrice − totalInvested` quando já vendido. */
  realizedProfit: Cents | null;
  /** `realizedProfit / salePrice` quando vendido com preço positivo. */
  realizedMarginRatio: number | null;
  /** `realizedProfit / totalInvested` quando vendido e `totalInvested > 0`. */
  realizedRoiRatio: number | null;
  /** Lucro esperado ao preço final pago (`expectedSalePrice − plannedTotalWithReserve`). */
  expectedProfitAtBid: Cents | null;
  /** Dias corridos desde o arremate até a venda (ou até `now` se ainda em carteira). */
  holdDays: number | null;
  /** Dias do arremate até o anúncio (`listedAt − acquiredAt`). */
  prepDays: number | null;
  /** Dias anunciado até vender (`soldAt − listedAt`). */
  saleDays: number | null;
  /** Retorno mensalizado linear (`realizedRoiRatio × 30 / holdDays`) para lotes vendidos com `holdDays > 0`. */
  monthlyRoiRatio: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayTimestamp(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function diffDays(start: Date | null, end: Date | null): number | null {
  if (start === null || end === null) return null;
  const days = Math.round((utcDayTimestamp(end) - utcDayTimestamp(start)) / DAY_MS);
  return Math.max(0, days);
}

/**
 * Converte uma análise fixada (v1, v2 ou v3) no detalhamento previsto para o preço final pago no leilão.
 * Retorna `null` se a análise não puder ser completada.
 */
export function plannedBreakdownFromFixedAnalysis(
  rawInputs: AnalysisInputs,
  formulaVersion: number,
  finalBid: Cents,
): PlannedCostBreakdown | null {
  const normalized = normalizeLegacyInputs(rawInputs, formulaVersion);
  const complete = completeInputs(normalized);
  if (!complete.ok) return null;
  const commission = commissionFor(finalBid, complete.value.commission);
  return {
    expectedSalePrice: complete.value.marketValue,
    riskReserve: complete.value.riskReserve,
    byCategory: {
      auction_commission: commission,
      auction_fees: normalized.otherFees ?? cents(0),
      debts: normalized.debtsCost ?? cents(0),
      transport: normalized.transportCost ?? cents(0),
      documentation: normalized.documentationCost ?? cents(0),
      repair: normalized.repairCost ?? cents(0),
      tires: normalized.tiresCost ?? cents(0),
      service: normalized.serviceCost ?? cents(0),
      selling: normalized.sellingCost ?? cents(0),
      tax: normalized.taxCost ?? cents(0),
      other: cents(0),
    },
  };
}

/** Calcula o resultado financeiro realizado e o desvio frente à análise fixada de um lote arrematado. */
export function calculateRealizedPnl(input: RealizedPnlInput): RealizedPnl {
  const actualByCategory: Record<ExpenseCategory, number> = {
    auction_commission: 0,
    auction_fees: 0,
    debts: 0,
    transport: 0,
    documentation: 0,
    repair: 0,
    tires: 0,
    service: 0,
    selling: 0,
    tax: 0,
    other: 0,
  };

  for (const expense of input.expenses) {
    actualByCategory[expense.category] += expense.amount;
  }

  const totalExpenses = sumCents(Object.values(actualByCategory).map((value) => cents(value)));
  const totalInvested = cents(input.finalBid + totalExpenses);

  const byCategory: CategoryVariance[] = [];
  for (const category of EXPENSE_CATEGORIES) {
    const actual = cents(actualByCategory[category]);
    const planned = input.planned ? input.planned.byCategory[category] : null;
    if (actual === 0 && (planned === null || planned === 0)) continue;
    const variance = planned === null ? null : cents(actual - planned);
    const varianceRatio = planned !== null && planned > 0 && variance !== null ? variance / planned : null;
    byCategory.push({ category, planned, actual, variance, varianceRatio });
  }

  const plannedExpensesSum = input.planned
    ? sumCents(EXPENSE_CATEGORIES.map((category) => input.planned?.byCategory[category] ?? cents(0)))
    : null;
  const plannedTotalWithoutReserve = plannedExpensesSum === null ? null : cents(input.finalBid + plannedExpensesSum);
  const plannedTotalWithReserve =
    plannedTotalWithoutReserve === null || input.planned === null
      ? null
      : cents(plannedTotalWithoutReserve + input.planned.riskReserve);
  const costVariance = plannedTotalWithoutReserve === null ? null : cents(totalInvested - plannedTotalWithoutReserve);
  const expectedProfitAtBid =
    input.planned === null || plannedTotalWithReserve === null
      ? null
      : cents(input.planned.expectedSalePrice - plannedTotalWithReserve);

  const realizedProfit = input.salePrice === null ? null : cents(input.salePrice - totalInvested);
  const realizedMarginRatio =
    realizedProfit !== null && input.salePrice !== null && input.salePrice > 0
      ? realizedProfit / input.salePrice
      : null;
  const realizedRoiRatio = realizedProfit !== null && totalInvested > 0 ? realizedProfit / totalInvested : null;

  const holdDays = diffDays(input.acquiredAt, input.soldAt ?? input.now);
  const prepDays = diffDays(input.acquiredAt, input.listedAt);
  const saleDays = diffDays(input.listedAt, input.soldAt);
  const monthlyRoiRatio =
    input.soldAt !== null && realizedRoiRatio !== null && holdDays !== null && holdDays > 0
      ? realizedRoiRatio * (30 / holdDays)
      : null;

  return {
    finalBid: input.finalBid,
    totalExpenses,
    totalInvested,
    plannedTotalWithoutReserve,
    plannedTotalWithReserve,
    costVariance,
    byCategory,
    realizedProfit,
    realizedMarginRatio,
    realizedRoiRatio,
    expectedProfitAtBid,
    holdDays,
    prepDays,
    saleDays,
    monthlyRoiRatio,
  };
}

export type PortfolioLotInput = {
  status: PostAuctionStatus;
  paymentDueAt: Date | null;
  paidAt: Date | null;
  salePrice: Cents | null;
  pnl: Pick<RealizedPnl, "totalInvested" | "realizedProfit" | "holdDays">;
};

export type PortfolioSummary = {
  totalLots: number;
  inProgressCount: number;
  soldCount: number;
  /** Soma do capital investido (lance + despesas) nos veículos ainda não vendidos. */
  capitalDeployed: Cents;
  /** Soma do lucro líquido realizado nos veículos vendidos. */
  totalRealizedProfit: Cents;
  /** Soma do investimento total nos veículos vendidos. */
  totalSoldInvested: Cents;
  /** Soma da receita de revenda nos veículos vendidos. */
  totalSoldRevenue: Cents;
  /** ROI ponderado sobre os veículos vendidos (`totalRealizedProfit / totalSoldInvested`). */
  averageRoiRatio: number | null;
  /** Mediana dos dias de giro dos veículos vendidos. */
  medianHoldDays: number | null;
  /** Quantos lotes têm prazo de pagamento vencido sem data de pagamento registrada. */
  overduePaymentCount: number;
};

/** Verifica se o pagamento do lote está vencido na data de referência (`YYYY-MM-DD` em UTC). */
export function isPaymentOverdue(paymentDueAt: Date | null, paidAt: Date | null, todayUtc: Date): boolean {
  if (paymentDueAt === null || paidAt !== null) return false;
  const dueKey = paymentDueAt.toISOString().slice(0, 10);
  const todayKey = todayUtc.toISOString().slice(0, 10);
  return dueKey < todayKey;
}

/** Consolida métricas da carteira de lotes arrematados pelo usuário (aba Carteira). */
export function summarizePortfolio(items: readonly PortfolioLotInput[], todayUtc: Date): PortfolioSummary {
  let inProgressCount = 0;
  let soldCount = 0;
  let capitalDeployed = 0;
  let totalRealizedProfit = 0;
  let totalSoldInvested = 0;
  let totalSoldRevenue = 0;
  let overduePaymentCount = 0;
  const soldHoldDays: number[] = [];

  for (const item of items) {
    if (isPaymentOverdue(item.paymentDueAt, item.paidAt, todayUtc)) overduePaymentCount += 1;
    if (item.status === "sold") {
      soldCount += 1;
      totalSoldInvested += item.pnl.totalInvested;
      if (item.salePrice !== null) totalSoldRevenue += item.salePrice;
      if (item.pnl.realizedProfit !== null) totalRealizedProfit += item.pnl.realizedProfit;
      if (item.pnl.holdDays !== null) soldHoldDays.push(item.pnl.holdDays);
    } else {
      inProgressCount += 1;
      capitalDeployed += item.pnl.totalInvested;
    }
  }

  soldHoldDays.sort((a, b) => a - b);
  const mid = Math.floor(soldHoldDays.length / 2);
  const medianHoldDays =
    soldHoldDays.length === 0
      ? null
      : soldHoldDays.length % 2 === 1
        ? (soldHoldDays[mid] ?? null)
        : Math.round(((soldHoldDays[mid - 1] ?? 0) + (soldHoldDays[mid] ?? 0)) / 2);

  return {
    totalLots: items.length,
    inProgressCount,
    soldCount,
    capitalDeployed: cents(capitalDeployed),
    totalRealizedProfit: cents(totalRealizedProfit),
    totalSoldInvested: cents(totalSoldInvested),
    totalSoldRevenue: cents(totalSoldRevenue),
    averageRoiRatio: totalSoldInvested > 0 ? totalRealizedProfit / totalSoldInvested : null,
    medianHoldDays,
    overduePaymentCount,
  };
}
