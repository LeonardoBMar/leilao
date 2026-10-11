import { z } from "zod";

import { COMPARABLE_LEVELS, ESTIMATE_CONFIDENCES } from "@/domain/listings/estimates";
import { cents } from "@/domain/money";
import type { LotMarketReference } from "@/features/research/types";

const centsSchema = z.number().int().nonnegative().transform(cents);

/**
 * Mercado do lote no momento da fixação (D-74, docs/PLANO-MERCADO.md §8): o recorte, a faixa, as vendas usadas (com o
 * lance final) e as tiradas da conta, e quando foi calculado. Gravado junto com a fixação e imutável como ela; alimenta
 * o bloco Concorrência da versão fixada e a Calibração. Lido do `jsonb` sempre por este schema.
 */
export const marketSnapshotSchema = z.object({
  version: z.literal(1),
  computedAt: z.coerce.date(),
  level: z.enum(COMPARABLE_LEVELS),
  scope: z.string(),
  sales: z.array(z.object({ id: z.string(), finalBid: centsSchema })),
  excludedIds: z.array(z.string()),
  band: z
    .object({ low: centsSchema, median: centsSchema, high: centsSchema, confidence: z.enum(ESTIMATE_CONFIDENCES) })
    .nullable(),
});

export type MarketSnapshot = z.infer<typeof marketSnapshotSchema>;

/** Valor do `jsonb` → snapshot; formato desconhecido vira `null` (a tela cai nas vendas de hoje). */
export function readMarketSnapshot(value: unknown): MarketSnapshot | null {
  if (value === null || value === undefined) return null;
  const parsed = marketSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Mercado do lote na hora de fixar → objeto do `jsonb` (datas em ISO; o schema acima lê de volta). */
export function snapshotOf(market: LotMarketReference, computedAt: Date) {
  return {
    version: 1,
    computedAt: computedAt.toISOString(),
    level: market.level,
    scope: market.scope,
    sales: market.sales.map(({ id, finalBid }) => ({ id, finalBid })),
    // O recorte do lote não tem vendas tiradas à mão; o campo fica para quando a análise as tiver.
    excludedIds: [],
    band: market.band === null ? null : { ...market.band },
  } satisfies z.input<typeof marketSnapshotSchema>;
}
