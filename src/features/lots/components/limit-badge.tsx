import { Badge } from "@/components/ui";
import { compareToFixedLimit, type FixedLimit } from "@/domain/finance/calculator";
import type { Cents } from "@/domain/money";
import { LIMIT_COMPARISON_LABELS, LIMIT_COMPARISON_VARIANTS } from "@/lib/limit-comparison";

import type { LotLimit } from "../types";

export function toFixedLimit(limit: LotLimit | null): FixedLimit | null {
  if (!limit) return null;
  return limit.isViable && limit.maxBid !== null ? { isViable: true, maxBid: limit.maxBid } : { isViable: false };
}

/** Situação do lance atual frente ao limite fixado (SPEC §7.5). Texto sempre presente junto da cor. */
export function LimitBadge({ limit, bid }: { limit: LotLimit | null; bid: Cents | null }) {
  const comparison = compareToFixedLimit(toFixedLimit(limit), bid);
  return <Badge variant={LIMIT_COMPARISON_VARIANTS[comparison]}>{LIMIT_COMPARISON_LABELS[comparison]}</Badge>;
}
