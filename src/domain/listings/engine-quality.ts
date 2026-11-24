import { z } from "zod";

import { type BacktestOutcome, summarizeBacktest, summarizeBacktestBy } from "./backtest";

/** Versão atual do formato e do motor avaliado nos snapshots de qualidade (`v1`, D-76). */
export const ENGINE_QUALITY_VERSION = 1;

/** Intervalo padrão entre execuções automáticas do backtest no coletor (7 dias). */
export const ENGINE_QUALITY_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** Data inicial padrão dos alvos do backtest (quando a base passou de mil vendas, D-76). */
export const DEFAULT_ENGINE_QUALITY_FROM = new Date("2026-09-15T00:00:00-03:00");

/** Janela máxima de alvos avaliados no backtest semanal automático (180 dias), para manter custo estável. */
export const ENGINE_QUALITY_TARGET_WINDOW_MS = 180 * 24 * 60 * 60 * 1000;

/** Início da janela móvel de avaliação: nunca anterior a `DEFAULT_ENGINE_QUALITY_FROM`. */
export function engineQualityWindowStart(now: Date): Date {
  return new Date(Math.max(DEFAULT_ENGINE_QUALITY_FROM.getTime(), now.getTime() - ENGINE_QUALITY_TARGET_WINDOW_MS));
}

const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export const engineQualityBucketSchema = z.object({
  total: z.number().int().nonnegative(),
  estimated: z.number().int().nonnegative(),
  hitRate: z.number().min(0).max(1).nullable(),
  medianAbsError: z.number().nonnegative().nullable(),
});

export type EngineQualityBucket = z.infer<typeof engineQualityBucketSchema>;

export const engineQualityReportSchema = z.object({
  version: z.literal(ENGINE_QUALITY_VERSION),
  computedAt: z.coerce.date(),
  from: z.coerce.date(),
  total: engineQualityBucketSchema,
  byConfidence: z
    .object({
      high: engineQualityBucketSchema,
      medium: engineQualityBucketSchema,
      low: engineQualityBucketSchema,
    })
    .partial(),
});

export type EngineQualityReport = z.infer<typeof engineQualityReportSchema>;

export type SerializedEngineQualityReport = Omit<EngineQualityReport, "computedAt" | "from"> & {
  computedAt: string;
  from: string;
};

/**
 * Monta o relatório de qualidade do motor a partir dos resultados do backtest (`runBacktest`). Puro.
 */
export function buildEngineQualityReport(
  outcomes: readonly BacktestOutcome[],
  options: { computedAt: Date; from: Date },
): EngineQualityReport {
  const byConfidenceMap = summarizeBacktestBy(outcomes, ({ estimate }) =>
    estimate.kind === "insufficient" ? "none" : estimate.confidence,
  );
  const byConfidence: EngineQualityReport["byConfidence"] = {};
  for (const level of CONFIDENCE_LEVELS) {
    const summary = byConfidenceMap.get(level);
    if (summary !== undefined) {
      byConfidence[level] = summary;
    }
  }
  return {
    version: ENGINE_QUALITY_VERSION,
    computedAt: options.computedAt,
    from: options.from,
    total: summarizeBacktest(outcomes),
    byConfidence,
  };
}

/** Converte datas para ISO-8601 para gravação em JSONB ou arquivo estático. */
export function serializeEngineQualityReport(report: EngineQualityReport): SerializedEngineQualityReport {
  return {
    version: report.version,
    computedAt: report.computedAt.toISOString(),
    from: report.from.toISOString(),
    total: report.total,
    byConfidence: report.byConfidence,
  };
}

/**
 * Diz se o último snapshot já venceu (ou não existe) e o backtest deve rodar novamente.
 * Sem snapshot anterior, retorna `true`; com snapshot, vence a partir de `intervalMs` (padrão 7 dias).
 */
export function isEngineQualityStale(
  latestComputedAt: Date | null,
  now: Date,
  intervalMs: number = ENGINE_QUALITY_REFRESH_INTERVAL_MS,
): boolean {
  if (latestComputedAt === null) return true;
  return now.getTime() - latestComputedAt.getTime() >= intervalMs;
}

/** Valida um payload desconhecido (JSONB ou arquivo estático); formato inválido vira `null`. */
export function parseEngineQualityReport(value: unknown): EngineQualityReport | null {
  const parsed = engineQualityReportSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
