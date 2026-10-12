import { z } from "zod";

import data from "./engine-quality.json";

const summarySchema = z.object({
  total: z.number().int().nonnegative(),
  estimated: z.number().int().nonnegative(),
  hitRate: z.number().nullable(),
  medianAbsError: z.number().nullable(),
});

/**
 * Qualidade do motor do preço provável (D-76): o resumo do backtest (`npm run db:estimate-backtest -- --write`), que
 * estima cada venda só com as vendas de dias anteriores. Fica num arquivo versionado, atualizado pelo script e levado
 * no commit; a data diz de quando é.
 */
export const engineQualitySchema = z.object({
  version: z.literal(1),
  computedAt: z.coerce.date(),
  from: z.coerce.date(),
  total: summarySchema,
  byConfidence: z.object({ high: summarySchema, medium: summarySchema, low: summarySchema }).partial(),
});

export type EngineQuality = z.infer<typeof engineQualitySchema>;

/** O resumo gravado; formato desconhecido vira `null` (a aba omite a seção). */
export function readEngineQuality(value: unknown = data): EngineQuality | null {
  const parsed = engineQualitySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
