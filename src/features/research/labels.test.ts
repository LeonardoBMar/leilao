import { describe, expect, it } from "vitest";

import { excludedLabel, mileageLabel, riseLabel } from "./labels";

describe("riseLabel", () => {
  it("sobe com mais, cai com menos", () => {
    expect(riseLabel(0.93)).toBe("+8%");
    expect(riseLabel(1)).toBe("+0%");
    expect(riseLabel(1.03)).toBe("−3%");
  });
});

describe("excludedLabel", () => {
  it("diz cada motivo com a contagem", () => {
    expect(excludedLabel({ noMarketValue: 1_506, outOfBounds: 3 })).toBe(
      "1.506 sem valor de mercado · 3 com % fora de 1% a 200%",
    );
    expect(excludedLabel({ noMarketValue: 0, outOfBounds: 2 })).toBe("2 com % fora de 1% a 200%");
  });

  it("sem venda de fora, nada", () => {
    expect(excludedLabel({ noMarketValue: 0, outOfBounds: 0 })).toBeNull();
  });
});

describe("mileageLabel", () => {
  it("em milhares de km", () => {
    expect(mileageLabel(100_000)).toBe("100 mil km");
  });
});
