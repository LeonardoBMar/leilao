import type { FixedLimit } from "@/domain/finance/calculator";

import type { LotLimit } from "./types";

/** Limite do lote no formato do domínio (`compareToFixedLimit`, `roomToFixedLimit`). Sem análise fixada: `null`. */
export function toFixedLimit(limit: LotLimit | null): FixedLimit | null {
  if (!limit) return null;
  return limit.isViable && limit.maxBid !== null ? { isViable: true, maxBid: limit.maxBid } : { isViable: false };
}
