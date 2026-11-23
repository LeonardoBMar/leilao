import { describe, expect, it } from "vitest";

import {
  COLLECTOR_RUN_RETENTION_DAYS,
  collectorRunRetentionCutoff,
  isRawPrunable,
  PRUNABLE_RAW_STATUSES,
  RAW_RETENTION_DAYS,
  rawRetentionCutoff,
} from "./retention";
import { isFinalStatus } from "./types";

const NOW = new Date("2026-11-23T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

describe("retention", () => {
  it("calcula cortes de 90 dias para raw e collector_runs", () => {
    expect(rawRetentionCutoff(NOW).getTime()).toBe(NOW.getTime() - RAW_RETENTION_DAYS * DAY_MS);
    expect(collectorRunRetentionCutoff(NOW).getTime()).toBe(NOW.getTime() - COLLECTOR_RUN_RETENTION_DAYS * DAY_MS);
  });

  it("lista apenas status definitivos como elegíveis para compactação de raw", () => {
    for (const status of PRUNABLE_RAW_STATUSES) {
      expect(isFinalStatus(status)).toBe(true);
    }
  });

  it("permite compactar anúncio definitivo sem próxima revisita e mais antigo que o corte", () => {
    expect(
      isRawPrunable({ status: "sold", nextCheckAt: null, lastCheckedAt: daysAgo(RAW_RETENTION_DAYS + 1) }, NOW),
    ).toBe(true);
    expect(isRawPrunable({ status: "unsold", nextCheckAt: null, lastCheckedAt: daysAgo(120) }, NOW)).toBe(true);
  });

  it("nunca compacta anúncios abertos, condicionais, desconhecidos, com revisita agendada ou dentro da janela", () => {
    expect(isRawPrunable({ status: "open", nextCheckAt: null, lastCheckedAt: daysAgo(120) }, NOW)).toBe(false);
    expect(isRawPrunable({ status: "conditional", nextCheckAt: null, lastCheckedAt: daysAgo(120) }, NOW)).toBe(false);
    expect(isRawPrunable({ status: "unknown", nextCheckAt: null, lastCheckedAt: daysAgo(120) }, NOW)).toBe(false);
    expect(isRawPrunable({ status: "sold", nextCheckAt: daysAgo(1), lastCheckedAt: daysAgo(120) }, NOW)).toBe(false);
    expect(isRawPrunable({ status: "sold", nextCheckAt: null, lastCheckedAt: daysAgo(RAW_RETENTION_DAYS) }, NOW)).toBe(
      false,
    );
    expect(isRawPrunable({ status: "sold", nextCheckAt: null, lastCheckedAt: daysAgo(30) }, NOW)).toBe(false);
  });
});
