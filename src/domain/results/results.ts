import { compareToFixedLimit, type FixedLimit, type LimitComparison } from "@/domain/finance/calculator";
import { type Cents, cents } from "@/domain/money";

/** Desfechos do lote (SPEC RF-06). "sold" descreve o lote, mesmo quando outra pessoa arrematou. */
export const LOT_OUTCOMES = ["sold", "unsold", "withdrawn", "cancelled", "unknown"] as const;
export type LotOutcome = (typeof LOT_OUTCOMES)[number];

export const PERSONAL_OUTCOMES = ["observed", "bid_not_won", "won"] as const;
export type PersonalOutcome = (typeof PERSONAL_OUTCOMES)[number];

export type AnalysisTiming = "prior" | "retrospective" | "unknown";

/**
 * Análise sugerida para o vínculo com o resultado (RF-05): a fixada mais recente que não foi feita conhecendo o
 * resultado; sem ela, a fixada mais recente. Recebe as fixadas da mais nova para a mais antiga.
 */
export function suggestedAnalysis<T extends { knownResultAtCreation: boolean }>(
  fixedNewestFirst: readonly T[],
): T | undefined {
  return fixedNewestFirst.find((analysis) => !analysis.knownResultAtCreation) ?? fixedNewestFirst[0];
}

/**
 * Temporalidade da análise vinculada ao resultado (SPEC §10). É anterior ao resultado quando:
 * 1. foi fixada antes do primeiro registro de resultado do lote;
 * 2. foi fixada antes do horário real do desfecho, se conhecido;
 * 3. não foi feita conhecendo o resultado;
 * 4. sem horário real, o usuário declarou que ela antecedeu o desfecho.
 * Sem horário real e sem declaração, a temporalidade é desconhecida.
 */
export function classifyAnalysisTiming(input: {
  analysisFixedAt: Date;
  knownResultAtCreation: boolean;
  /** Registro da primeira revisão do resultado (ou o instante atual, ao registrar a primeira). */
  firstResultRecordedAt: Date;
  /** Horário real do desfecho, quando conhecido. */
  eventAt: Date | null;
  /** O usuário declarou que a análise antecedeu o desfecho. */
  priorDeclared: boolean;
}): AnalysisTiming {
  if (input.knownResultAtCreation) return "retrospective";
  if (input.analysisFixedAt >= input.firstResultRecordedAt) return "retrospective";
  if (input.eventAt !== null) return input.analysisFixedAt < input.eventAt ? "prior" : "retrospective";
  return input.priorDeclared ? "prior" : "unknown";
}

export type ResultComparison =
  | { kind: "comparable"; comparison: LimitComparison; finalBid: Cents; maxBid: Cents | null; difference: Cents | null }
  | { kind: "not_comparable"; reason: "not_sold" | "unknown_price" | "no_analysis" };

/**
 * Comparação do preço final com o limite da análise vinculada (SPEC §10). Só há comparação numérica para
 * lote arrematado com preço conhecido e análise vinculada (CA-12). `difference` = preço final − limite
 * (positivo: acima do limite). Não representa perda nem compra realizada.
 */
export function compareResult(input: {
  outcome: LotOutcome;
  finalBid: Cents | null;
  limit: FixedLimit | null;
}): ResultComparison {
  if (input.outcome !== "sold") return { kind: "not_comparable", reason: "not_sold" };
  if (input.finalBid === null) return { kind: "not_comparable", reason: "unknown_price" };
  if (input.limit === null) return { kind: "not_comparable", reason: "no_analysis" };

  const comparison = compareToFixedLimit(input.limit, input.finalBid);
  const maxBid = input.limit.isViable ? input.limit.maxBid : null;
  return {
    kind: "comparable",
    comparison,
    finalBid: input.finalBid,
    maxBid,
    difference: maxBid === null ? null : cents(input.finalBid - maxBid),
  };
}

export type IndicatorItem = { timing: AnalysisTiming; comparison: ResultComparison };

/**
 * Indicador inicial (SPEC §10): resultados comparáveis com análise anterior elegível e quantos ficaram dentro
 * do limite. Sem lance viável entra no denominador e nunca no numerador. Um item por lote (resultado vigente).
 */
export function limitIndicator(items: readonly IndicatorItem[]): { comparable: number; withinLimit: number } {
  let comparable = 0;
  let withinLimit = 0;
  for (const { timing, comparison } of items) {
    if (timing !== "prior" || comparison.kind !== "comparable") continue;
    comparable += 1;
    if (comparison.comparison === "below_limit" || comparison.comparison === "at_limit") withinLimit += 1;
  }
  return { comparable, withinLimit };
}
