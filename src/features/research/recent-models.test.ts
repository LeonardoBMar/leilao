import { describe, expect, it } from "vitest";

import { withRecentModel } from "./recent-models";

const gol = { brand: "volkswagen", model: "gol" };
const onix = { brand: "chevrolet", model: "onix" };
const hb20 = { brand: "hyundai", model: "hb20" };

describe("withRecentModel", () => {
  it("coloca o modelo escolhido na frente", () => {
    expect(withRecentModel([gol], onix)).toEqual([onix, gol]);
  });

  it("não repete um modelo já lembrado: ele só sobe para a frente", () => {
    expect(withRecentModel([gol, onix, hb20], hb20)).toEqual([hb20, gol, onix]);
  });

  it("descarta o mais antigo ao passar do limite", () => {
    expect(withRecentModel([gol, onix], hb20, 2)).toEqual([hb20, gol]);
  });

  it("mantém só marca e modelo", () => {
    const option = { ...gol, label: "VW Gol", sales: 10 };
    expect(withRecentModel([], option)).toEqual([gol]);
  });
});
