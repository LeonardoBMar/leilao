import type { LimitComparison } from "@/domain/finance/calculator";

/** Textos da interface para a comparação com o limite (SPEC §7.5). Cor sempre acompanhada de texto. */
export const LIMIT_COMPARISON_LABELS = {
  below_limit: "Abaixo do seu limite",
  at_limit: "No seu limite",
  above_limit: "Acima do seu limite",
  no_viable_bid: "Sem lance viável",
  unavailable: "Comparação indisponível",
} satisfies Record<LimitComparison, string>;

export const LIMIT_COMPARISON_VARIANTS = {
  below_limit: "success",
  at_limit: "warning",
  above_limit: "destructive",
  no_viable_bid: "outline",
  unavailable: "default",
} as const satisfies Record<LimitComparison, "success" | "warning" | "destructive" | "outline" | "default">;
