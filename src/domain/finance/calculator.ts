import { applyRate, type Bps, type Cents, cents, sumCents } from "@/domain/money";

/**
 * Calculadora financeira do SPEC §7. Puro: sem I/O, relógio ou exceções para casos esperados.
 * A mesma função serve à prévia no navegador e ao servidor ao fixar a análise.
 *
 *   comissão(L)        = K + arredondar_centavos(p × L)
 *   custo total(L)     = L + F + comissão(L) + R
 *   margem(L)          = V − custo total(L)
 *   lance máximo       = maior L em centavos com custo total(L) + M ≤ V
 *
 * Reserva (R) e margem (M) podem ser informadas em R$ ou em % do valor de venda (V); em %, R = r × V e M = m × V,
 * arredondados ao centavo (D-38).
 */

/** Muda sempre que uma fórmula mudar. É persistida com cada análise fixada e nunca recalculada (SPEC §8). */
export const FORMULA_VERSION = 2;

export type CommissionMode = "fixed" | "percentage";

/** Entradas como o usuário as informou. `null` = não informado (≠ zero; SPEC §7.6). */
export type AnalysisInputs = {
  marketValue: Cents | null;
  repairCost: Cents | null;
  documentationCost: Cents | null;
  transportCost: Cents | null;
  tiresCost: Cents | null;
  serviceCost: Cents | null;
  otherFees: Cents | null;
  commissionMode: CommissionMode | null;
  commissionFixed: Cents | null;
  commissionRateBps: Bps | null;
  riskReserve: Cents | null;
  /** Reserva em % do valor de venda; quando informada, vale no lugar de `riskReserve`. */
  riskReserveRateBps: Bps | null;
  desiredMargin: Cents | null;
  /** Margem em % do valor de venda; quando informada, vale no lugar de `desiredMargin`. */
  desiredMarginRateBps: Bps | null;
};

/** Campos da lista de pendências: reserva e margem contam uma vez cada, em R$ ou em %. */
export type AnalysisField = Exclude<keyof AnalysisInputs, "riskReserveRateBps" | "desiredMarginRateBps">;

/** Uma modalidade de comissão por análise: a desativada não participa da conta (SPEC §7.1). */
export type Commission = { mode: "fixed"; amount: Cents } | { mode: "percentage"; rate: Bps };

/** Entradas completas, prontas para o cálculo. */
export type CompleteInputs = {
  marketValue: Cents;
  fixedCosts: Cents;
  commission: Commission;
  riskReserve: Cents;
  desiredMargin: Cents;
};

export type MaxBidOutcome =
  | { kind: "incomplete"; missing: AnalysisField[] }
  | { kind: "not_viable"; fixedCosts: Cents }
  | {
      kind: "viable";
      maxBid: Cents;
      fixedCosts: Cents;
      commissionAtMaxBid: Cents;
      totalAtMaxBid: Cents;
      marginAtMaxBid: Cents;
    };

export type BidSimulation = {
  bid: Cents;
  commission: Cents;
  /** F + comissão, sem reserva (SPEC §7.3). */
  costsBesidesBid: Cents;
  totalCost: Cents;
  estimatedMargin: Cents;
};

/** Situação de um lance em relação ao limite (SPEC §7.5). Rótulos de interface ficam na feature. */
export type LimitComparison = "below_limit" | "at_limit" | "above_limit" | "no_viable_bid" | "unavailable";

const FIXED_COST_FIELDS = [
  "repairCost",
  "documentationCost",
  "transportCost",
  "tiresCost",
  "serviceCost",
  "otherFees",
] as const satisfies readonly AnalysisField[];

/** Campos que faltam para calcular, na ordem do formulário. Rascunhos exibem esta lista. */
export function missingFields(inputs: AnalysisInputs): AnalysisField[] {
  const missing: AnalysisField[] = [];
  if (inputs.marketValue === null) missing.push("marketValue");
  for (const field of FIXED_COST_FIELDS) if (inputs[field] === null) missing.push(field);
  if (inputs.commissionMode === null) missing.push("commissionMode");
  if (inputs.commissionMode === "fixed" && inputs.commissionFixed === null) missing.push("commissionFixed");
  if (inputs.commissionMode === "percentage" && inputs.commissionRateBps === null) missing.push("commissionRateBps");
  if (inputs.riskReserve === null && inputs.riskReserveRateBps === null) missing.push("riskReserve");
  if (inputs.desiredMargin === null && inputs.desiredMarginRateBps === null) missing.push("desiredMargin");
  return missing;
}

/** Entradas completas ou a lista do que falta. Nunca transforma ausência em zero. */
export function completeInputs(
  inputs: AnalysisInputs,
): { ok: true; value: CompleteInputs } | { ok: false; missing: AnalysisField[] } {
  const missing = missingFields(inputs);
  const { marketValue } = inputs;
  const riskReserve = byRateOrAmount(marketValue, inputs.riskReserveRateBps, inputs.riskReserve);
  const desiredMargin = byRateOrAmount(marketValue, inputs.desiredMarginRateBps, inputs.desiredMargin);
  const commission = toCommission(inputs);
  const costs = FIXED_COST_FIELDS.map((field) => inputs[field]).filter((cost): cost is Cents => cost !== null);
  if (
    missing.length > 0 ||
    marketValue === null ||
    riskReserve === null ||
    desiredMargin === null ||
    commission === null ||
    costs.length !== FIXED_COST_FIELDS.length
  ) {
    return { ok: false, missing };
  }

  const amounts = [marketValue, riskReserve, desiredMargin, ...costs];
  if (commission.mode === "fixed") amounts.push(commission.amount);
  // Os schemas e o banco já barram negativos; aqui é invariante do domínio (SPEC §7.6).
  if (amounts.some((amount) => amount < 0)) throw new RangeError("Entradas da análise não podem ser negativas.");

  return { ok: true, value: { marketValue, fixedCosts: sumCents(costs), commission, riskReserve, desiredMargin } };
}

export function commissionFor(bid: Cents, commission: Commission): Cents {
  return commission.mode === "fixed" ? commission.amount : applyRate(bid, commission.rate);
}

export function simulateBid(inputs: CompleteInputs, bid: Cents): BidSimulation {
  if (bid < 0) throw new RangeError(`Lance não pode ser negativo: ${bid}`);
  const commission = commissionFor(bid, inputs.commission);
  const costsBesidesBid = cents(inputs.fixedCosts + commission);
  const totalCost = cents(bid + costsBesidesBid + inputs.riskReserve);
  return {
    bid,
    commission,
    costsBesidesBid,
    totalCost,
    estimatedMargin: cents(inputs.marketValue - totalCost),
  };
}

/** Maior lance em centavos que preserva a margem desejada (SPEC §7.2). */
export function calculateMaxBid(inputs: AnalysisInputs): MaxBidOutcome {
  const complete = completeInputs(inputs);
  if (!complete.ok) return { kind: "incomplete", missing: complete.missing };

  const value = complete.value;
  const maxBid = findMaxBid(value);
  if (maxBid === null) return { kind: "not_viable", fixedCosts: value.fixedCosts };

  const atMax = simulateBid(value, maxBid);
  return {
    kind: "viable",
    maxBid,
    fixedCosts: value.fixedCosts,
    commissionAtMaxBid: atMax.commission,
    totalAtMaxBid: atMax.totalCost,
    marginAtMaxBid: atMax.estimatedMargin,
  };
}

export type PreparedFixedAnalysis = {
  riskReserve: Cents;
  desiredMargin: Cents;
  isViable: boolean;
  maxBid: Cents | null;
  totalAtMaxBid: Cents | null;
  marginAtMaxBid: Cents | null;
};

export type PrepareFixedError = "incomplete" | "market_value_not_positive";

/** Valida e calcula as colunas gravadas ao fixar uma análise (RF-05, SPEC §7.6). */
export function prepareFixedAnalysis(
  inputs: AnalysisInputs,
): { ok: true; value: PreparedFixedAnalysis } | { ok: false; error: PrepareFixedError } {
  const outcome = calculateMaxBid(inputs);
  const complete = completeInputs(inputs);
  if (outcome.kind === "incomplete" || !complete.ok) return { ok: false, error: "incomplete" };
  if (inputs.marketValue === null || inputs.marketValue <= 0) {
    return { ok: false, error: "market_value_not_positive" };
  }
  return {
    ok: true,
    value: {
      riskReserve: complete.value.riskReserve,
      desiredMargin: complete.value.desiredMargin,
      isViable: outcome.kind === "viable",
      maxBid: outcome.kind === "viable" ? outcome.maxBid : null,
      totalAtMaxBid: outcome.kind === "viable" ? outcome.totalAtMaxBid : null,
      marginAtMaxBid: outcome.kind === "viable" ? outcome.marginAtMaxBid : null,
    },
  };
}

/** Diferença para o limite: positiva = folga, negativa = acima do limite. */
export function differenceToLimit(maxBid: Cents, bid: Cents): Cents {
  return cents(maxBid - bid);
}

/** Compara um lance (ou preço final) ao limite de uma análise (SPEC §7.5 e §10). */
export function compareToLimit(outcome: MaxBidOutcome, bid: Cents | null): LimitComparison {
  if (outcome.kind === "incomplete") return "unavailable";
  return compareToFixedLimit(
    outcome.kind === "viable" ? { isViable: true, maxBid: outcome.maxBid } : { isViable: false },
    bid,
  );
}

/** Limite preservado numa análise fixada (`is_viable` + `max_bid_cents`). */
export type FixedLimit = { isViable: false } | { isViable: true; maxBid: Cents };

/** Mesma comparação a partir do limite já fixado. Sem análise fixada ou sem lance: indisponível. */
export function compareToFixedLimit(limit: FixedLimit | null, bid: Cents | null): LimitComparison {
  if (limit === null || bid === null) return "unavailable";
  if (!limit.isViable) return "no_viable_bid";
  if (bid < limit.maxBid) return "below_limit";
  return bid === limit.maxBid ? "at_limit" : "above_limit";
}

/**
 * Folga até o limite fixado: limite − lance (negativa acima do limite). Sem limite viável ou sem lance: `null`.
 * Ordena "Minhas análises" por "maior folga".
 */
export function roomToFixedLimit(limit: FixedLimit | null, bid: Cents | null): Cents | null {
  if (limit === null || !limit.isViable || bid === null) return null;
  return differenceToLimit(limit.maxBid, bid);
}

function fitsBudget(inputs: CompleteInputs, bid: Cents): boolean {
  return simulateBid(inputs, bid).totalCost + inputs.desiredMargin <= inputs.marketValue;
}

/**
 * Parte da divisão teórica (V − F − K − R − M) / (1 + p) e confere a desigualdade depois de arredondar
 * a comissão, ajustando centavo a centavo. Devolve `null` quando nem 1 centavo cabe no orçamento.
 */
function findMaxBid(inputs: CompleteInputs): Cents | null {
  const { commission } = inputs;
  const fixedCommission = commission.mode === "fixed" ? commission.amount : 0;
  const rate = commission.mode === "percentage" ? commission.rate : 0;
  const budget = inputs.marketValue - inputs.fixedCosts - fixedCommission - inputs.riskReserve - inputs.desiredMargin;
  if (budget < 1) return null;

  let candidate = Math.floor((budget * 10_000) / (10_000 + rate));
  // O arredondamento da comissão desloca o limite em no máximo poucos centavos.
  while (fitsBudget(inputs, cents(candidate + 1))) candidate += 1;
  while (candidate > 0 && !fitsBudget(inputs, cents(candidate))) candidate -= 1;

  return candidate >= 1 ? cents(candidate) : null;
}

/** Valor em R$ de uma premissa que pode vir em % do valor de venda. O % tem precedência. */
function byRateOrAmount(marketValue: Cents | null, rate: Bps | null, amount: Cents | null): Cents | null {
  if (rate === null) return amount;
  return marketValue === null || marketValue < 0 ? null : applyRate(marketValue, rate);
}

function toCommission(inputs: AnalysisInputs): Commission | null {
  if (inputs.commissionMode === "fixed" && inputs.commissionFixed !== null) {
    return { mode: "fixed", amount: inputs.commissionFixed };
  }
  if (inputs.commissionMode === "percentage" && inputs.commissionRateBps !== null) {
    return { mode: "percentage", rate: inputs.commissionRateBps };
  }
  return null;
}
