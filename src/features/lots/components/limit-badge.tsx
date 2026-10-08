import { Badge } from "@/components/ui";
import { compareToFixedLimit } from "@/domain/finance/calculator";
import type { Cents } from "@/domain/money";
import { LIMIT_COMPARISON_LABELS, LIMIT_COMPARISON_VARIANTS } from "@/lib/limit-comparison";

import { toFixedLimit } from "../limit";
import type { LotLimit } from "../types";

/** Situação do lance atual frente ao limite fixado (SPEC §7.5). Texto sempre presente junto da cor; nada quando indisponível. */
export function LimitBadge({ limit, bid }: { limit: LotLimit | null; bid: Cents | null }) {
  const comparison = compareToFixedLimit(toFixedLimit(limit), bid);
  // Sem limite ou sem lance, a barra de posição (LimitProgress) já diz o que falta.
  if (comparison === "unavailable") return null;
  return <Badge variant={LIMIT_COMPARISON_VARIANTS[comparison]}>{LIMIT_COMPARISON_LABELS[comparison]}</Badge>;
}
