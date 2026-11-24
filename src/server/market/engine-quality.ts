import "server-only";

import { runBacktest } from "@/domain/listings/backtest";
import {
  buildEngineQualityReport,
  DEFAULT_ENGINE_QUALITY_FROM,
  ENGINE_QUALITY_VERSION,
  type EngineQualityReport,
  isEngineQualityStale,
  serializeEngineQualityReport,
} from "@/domain/listings/engine-quality";
import { buildEstimateIndex, estimatePrice, SALES_WINDOW_MS } from "@/domain/listings/estimates";
import { db } from "@/server/db";

import { loadSoldSales } from "./sold-sales";

export type EngineQualityRefreshSummary =
  | { status: "skipped"; latestComputedAt: Date }
  | { status: "skipped_empty"; total: number }
  | { status: "saved"; id: string; computedAt: Date; total: number; estimated: number };

const V1_BACKTEST_OPTIONS = { levels: ["model"], preferOrigin: false } as const;

/** Persiste um relatório de qualidade do motor em `engine_quality_snapshots`. */
export async function saveEngineQualitySnapshot(report: EngineQualityReport): Promise<{ id: string }> {
  return db.engineQualitySnapshot.create({
    data: {
      version: report.version,
      computedAt: report.computedAt,
      fromDate: report.from,
      payload: serializeEngineQualityReport(report),
    },
    select: { id: true },
  });
}

/**
 * Atualiza o snapshot de qualidade do motor (`v1`, D-76) se não houver nenhum para a versão atual, se o último tiver
 * 7 dias ou mais, ou quando `force: true`. Roda a partir de `loadSoldSales()` com a mesma lógica do script de backtest.
 */
export async function refreshEngineQualitySnapshot(
  now: Date = new Date(),
  options: { force?: boolean; from?: Date } = {},
): Promise<EngineQualityRefreshSummary> {
  if (!options.force) {
    const latest = await db.engineQualitySnapshot.findFirst({
      where: { version: ENGINE_QUALITY_VERSION },
      orderBy: { computedAt: "desc" },
      select: { computedAt: true },
    });
    if (latest !== null && !isEngineQualityStale(latest.computedAt, now)) {
      return { status: "skipped", latestComputedAt: latest.computedAt };
    }
  }

  const from = options.from ?? DEFAULT_ENGINE_QUALITY_FROM;
  const sales = await loadSoldSales();
  const outcomes = runBacktest(
    sales,
    (prior) => {
      const index = buildEstimateIndex(prior);
      return (target) => estimatePrice(target, index, V1_BACKTEST_OPTIONS);
    },
    { from, windowMs: SALES_WINDOW_MS },
  );
  const report = buildEngineQualityReport(outcomes, { computedAt: now, from });
  if (report.total.estimated === 0) {
    return { status: "skipped_empty", total: report.total.total };
  }

  const saved = await saveEngineQualitySnapshot(report);
  return {
    status: "saved",
    id: saved.id,
    computedAt: report.computedAt,
    total: report.total.total,
    estimated: report.total.estimated,
  };
}
