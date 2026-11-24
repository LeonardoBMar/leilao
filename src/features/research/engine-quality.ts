import {
  type EngineQualityReport,
  engineQualityReportSchema,
  parseEngineQualityReport,
} from "@/domain/listings/engine-quality";

import data from "./engine-quality.json";

/**
 * Qualidade do motor do preço provável (D-76): fallback estático gravado pelo script
 * (`npm run db:estimate-backtest -- --write`) quando `engine_quality_snapshots` ainda não tem registros.
 */
export const engineQualitySchema = engineQualityReportSchema;

export type EngineQuality = EngineQualityReport;

export type EngineQualitySource = "auto" | "static";

export type EngineQualityData = {
  source: EngineQualitySource;
  latest: EngineQualityReport;
  history: EngineQualityReport[];
};

/** O resumo gravado no arquivo estático; formato desconhecido vira `null` (a aba omite a seção). */
export function readEngineQuality(value: unknown = data): EngineQuality | null {
  return parseEngineQualityReport(value);
}

/**
 * Monta os dados de qualidade a partir dos snapshots do banco, fazendo fallback automático para o
 * arquivo estático quando não há nenhum snapshot válido gravado.
 */
export function resolveEngineQualityData(
  payloads: readonly unknown[],
  fallbackValue: unknown = data,
): EngineQualityData | null {
  const history = payloads.flatMap((payload) => {
    const parsed = parseEngineQualityReport(payload);
    return parsed === null ? [] : [parsed];
  });
  const latest = history[0];
  if (latest !== undefined) {
    return { source: "auto", latest, history };
  }
  const fallback = readEngineQuality(fallbackValue);
  if (fallback === null) return null;
  return { source: "static", latest: fallback, history: [fallback] };
}
