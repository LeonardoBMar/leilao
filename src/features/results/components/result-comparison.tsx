import { Badge } from "@/components/ui";
import type { FixedLimit } from "@/domain/finance/calculator";
import { cents } from "@/domain/money";
import { compareResult } from "@/domain/results/results";
import { formatBRL } from "@/lib/format";
import { LIMIT_COMPARISON_VARIANTS } from "@/lib/limit-comparison";

import type { ResultRevision } from "../types";

const NOT_COMPARABLE = {
  not_sold: "Sem preço de arrematação: não há comparação com o limite.",
  unknown_price: "Preço final desconhecido: não há comparação com o limite.",
  no_analysis: "Nenhuma análise vinculada: não há comparação com o limite.",
} as const;

/**
 * Comparação do preço final com o limite da análise vinculada (SPEC §10, DESIGN.md §15.5): frase completa, com
 * sinal, sempre hipotética. Não afirma compra nem perda realizada.
 */
export function ResultComparison({ result }: { result: ResultRevision }) {
  const limit: FixedLimit | null = result.analysis
    ? result.analysis.isViable && result.analysis.maxBid !== null
      ? { isViable: true, maxBid: result.analysis.maxBid }
      : { isViable: false }
    : null;
  const comparison = compareResult({ outcome: result.outcome, finalBid: result.finalBid, limit });

  if (comparison.kind === "not_comparable") {
    return <p className="text-body text-muted">{NOT_COMPARABLE[comparison.reason]}</p>;
  }

  const { difference } = comparison;
  const sentence =
    comparison.comparison === "no_viable_bid"
      ? "A análise vinculada não tinha lance viável com aquelas premissas."
      : difference === null || difference === 0
        ? "Preço final no seu limite."
        : difference > 0
          ? `Preço final ${formatBRL(difference)} acima do seu limite.`
          : `Preço final ${formatBRL(cents(-difference))} abaixo do seu limite.`;
  const withinLimit = comparison.comparison === "below_limit" || comparison.comparison === "at_limit";

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={LIMIT_COMPARISON_VARIANTS[comparison.comparison]}>
          {withinLimit
            ? "Dentro do limite"
            : comparison.comparison === "above_limit"
              ? "Acima do limite"
              : "Sem lance viável"}
        </Badge>
        <p className="text-body text-foreground">{sentence}</p>
      </div>
      <p className="text-caption text-muted">
        Comparação hipotética com as premissas da análise v{result.analysis?.version}. Não indica compra nem perda
        realizada.
      </p>
    </div>
  );
}
