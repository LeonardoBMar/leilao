import {
  type AnalysisInputs,
  calculateMaxBid,
  type CompleteInputs,
  completeInputs,
  type MaxBidOutcome,
} from "@/domain/finance/calculator";
import { cents } from "@/domain/money";

import type { AnalysisOutputs } from "./types";

/** O que o resumo precisa: o limite e, quando as entradas estão completas, a base para simular lances. */
export type SummaryModel = { outcome: MaxBidOutcome; complete: CompleteInputs | null };

/** Rascunho: tudo calculado a partir das entradas atuais do formulário. */
export function liveSummary(inputs: AnalysisInputs): SummaryModel {
  const complete = completeInputs(inputs);
  return { outcome: calculateMaxBid(inputs), complete: complete.ok ? complete.value : null };
}

/**
 * Análise fixada: o limite e os totais vêm do que foi gravado na fixação (nunca recalculados; SPEC §8).
 * Só a simulação de novos lances usa a fórmula atual.
 */
export function fixedSummary(inputs: AnalysisInputs, outputs: AnalysisOutputs): SummaryModel {
  const complete = completeInputs(inputs);
  if (!complete.ok) return { outcome: { kind: "incomplete", missing: complete.missing }, complete: null };
  const base = complete.value;

  if (
    !outputs.isViable ||
    outputs.maxBid === null ||
    outputs.totalAtMaxBid === null ||
    outputs.marginAtMaxBid === null
  ) {
    return { outcome: { kind: "not_viable", fixedCosts: base.fixedCosts }, complete: base };
  }
  return {
    outcome: {
      kind: "viable",
      maxBid: outputs.maxBid,
      fixedCosts: base.fixedCosts,
      // Identidade do custo total: total = lance + F + comissão + R.
      commissionAtMaxBid: cents(outputs.totalAtMaxBid - outputs.maxBid - base.fixedCosts - base.riskReserve),
      totalAtMaxBid: outputs.totalAtMaxBid,
      marginAtMaxBid: outputs.marginAtMaxBid,
    },
    complete: base,
  };
}
