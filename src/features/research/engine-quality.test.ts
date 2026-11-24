import { describe, expect, it } from "vitest";

import { readEngineQuality, resolveEngineQualityData } from "./engine-quality";

describe("readEngineQuality", () => {
  it("lê o arquivo gravado pelo backtest", () => {
    const quality = readEngineQuality();
    expect(quality?.total.total).toBeGreaterThan(0);
    expect(quality?.computedAt).toBeInstanceOf(Date);
  });

  it("formato desconhecido vira null", () => {
    expect(readEngineQuality({ version: 2 })).toBeNull();
  });
});

describe("resolveEngineQualityData", () => {
  it("usa o fallback estático quando não há snapshots no banco", () => {
    const resolved = resolveEngineQualityData([]);
    expect(resolved?.source).toBe("static");
    expect(resolved?.history).toHaveLength(1);
    expect(resolved?.latest.total.total).toBeGreaterThan(0);
  });

  it("prioriza snapshots válidos do banco e ignora payloads corrompidos", () => {
    const newer = {
      version: 1,
      computedAt: "2026-11-24T12:00:00.000Z",
      from: "2026-09-15T03:00:00.000Z",
      total: { total: 8000, estimated: 6800, hitRate: 0.51, medianAbsError: 0.18 },
      byConfidence: {},
    };
    const older = {
      version: 1,
      computedAt: "2026-11-17T12:00:00.000Z",
      from: "2026-09-15T03:00:00.000Z",
      total: { total: 7500, estimated: 6300, hitRate: 0.49, medianAbsError: 0.19 },
      byConfidence: {},
    };

    const resolved = resolveEngineQualityData([newer, { version: 99 }, older]);
    expect(resolved?.source).toBe("auto");
    expect(resolved?.latest.total.total).toBe(8000);
    expect(resolved?.history).toHaveLength(2);
  });

  it("retorna null se banco e fallback estiverem inválidos", () => {
    expect(resolveEngineQualityData([{ version: 99 }], { version: 99 })).toBeNull();
  });
});
