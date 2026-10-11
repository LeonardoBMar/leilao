import { describe, expect, it } from "vitest";

import { cents } from "../money";
import {
  bandPlacement,
  calibrationByCategory,
  type CalibrationInput,
  limitDeviation,
  summarizeCalibration,
} from "./calibration";

const band = { low: cents(2_000_000), median: cents(2_500_000), high: cents(3_000_000) };

const item = (finalBid: number, limit: number | null, category: string | null = "Carros"): CalibrationInput => ({
  finalBid: cents(finalBid),
  limit: limit === null ? null : cents(limit),
  band,
  category,
});

describe("bandPlacement", () => {
  it("abaixo, dentro (pontas inclusive) e acima", () => {
    expect(bandPlacement(cents(1_999_999), band)).toBe("below");
    expect(bandPlacement(cents(2_000_000), band)).toBe("inside");
    expect(bandPlacement(cents(3_000_000), band)).toBe("inside");
    expect(bandPlacement(cents(3_000_001), band)).toBe("above");
  });
});

describe("limitDeviation", () => {
  it("fração do arremate: negativo é limite abaixo", () => {
    expect(limitDeviation(cents(2_200_000), cents(2_500_000))).toBeCloseTo(-0.12);
    expect(limitDeviation(cents(3_000_000), cents(2_500_000))).toBeCloseTo(0.2);
  });
});

describe("summarizeCalibration", () => {
  it("taxa dentro da faixa, desvio mediano e lotes que o limite alcançaria", () => {
    const summary = summarizeCalibration([
      item(2_500_000, 2_200_000),
      item(3_500_000, 3_000_000),
      item(1_500_000, 2_000_000),
      item(2_800_000, null),
      { ...item(2_000_000, 1_800_000), band: null },
    ]);
    expect(summary.n).toBe(5);
    expect(summary.band).toEqual({ n: 4, inside: 2, rate: 0.5 });
    expect(summary.limit.n).toBe(4);
    expect(summary.limit.reached).toBe(1);
    // Desvios: −0,12; −0,1429; +0,3333; −0,1 → mediana entre −0,12 e −0,1.
    expect(summary.limit.medianDeviation).toBeCloseTo(-0.11);
  });

  it("sem itens, sem taxa nem desvio", () => {
    expect(summarizeCalibration([])).toEqual({
      n: 0,
      band: { n: 0, inside: 0, rate: null },
      limit: { n: 0, medianDeviation: null, reached: 0 },
    });
  });
});

describe("calibrationByCategory", () => {
  it("agrupa pela categoria, da com mais resultados para a com menos", () => {
    const groups = calibrationByCategory([
      item(2_500_000, 2_200_000, "Motos"),
      item(2_500_000, 2_200_000),
      item(2_500_000, 2_200_000),
      item(2_500_000, 2_200_000, null),
    ]);
    expect(groups.map(({ category, summary }) => [category, summary.n])).toEqual([
      ["Carros", 2],
      [null, 1],
      ["Motos", 1],
    ]);
  });
});
