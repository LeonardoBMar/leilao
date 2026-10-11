import { describe, expect, it } from "vitest";

import { excludedLabel, mileageLabel } from "./labels";

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
