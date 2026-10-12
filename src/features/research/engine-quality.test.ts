import { describe, expect, it } from "vitest";

import { readEngineQuality } from "./engine-quality";

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
