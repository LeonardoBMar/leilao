import type { AnalysisTiming, LotOutcome, PersonalOutcome } from "@/domain/results/results";

/** "Arrematado" descreve o lote, mesmo quando outra pessoa comprou (RF-06). */
export const OUTCOME_LABELS = {
  sold: "Arrematado",
  unsold: "Sem arrematação",
  withdrawn: "Retirado",
  cancelled: "Cancelado",
  unknown: "Resultado desconhecido",
} satisfies Record<LotOutcome, string>;

export const PERSONAL_OUTCOME_LABELS = {
  observed: "Apenas observei",
  bid_not_won: "Participei e não arrematei",
  won: "Arrematei",
} satisfies Record<PersonalOutcome, string>;

export const TIMING_LABELS = {
  prior: "Análise anterior ao resultado",
  retrospective: "Análise retrospectiva",
  unknown: "Temporalidade desconhecida",
} satisfies Record<AnalysisTiming, string>;
