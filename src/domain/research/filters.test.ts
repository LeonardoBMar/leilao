import { describe, expect, it } from "vitest";

import { DEFAULT_RESEARCH_FILTERS, effectiveMetric, researchVehicle } from "./filters";

describe("researchVehicle", () => {
  it("agrupa como as estimativas: marca por extenso e primeira palavra do modelo", () => {
    expect(researchVehicle("Chevrolet", "Onix Plus LTZ")).toEqual({ brand: "CHEVROLET", model: "ONIX" });
    expect(researchVehicle("VW", "gol 1.0")).toEqual({ brand: "VOLKSWAGEN", model: "GOL" });
    expect(researchVehicle("Mercedes-Benz", "C 180")).toEqual({ brand: "MERCEDES BENZ", model: "C" });
  });

  it("sem marca ou modelo, não há veículo", () => {
    expect(researchVehicle("", "Onix")).toBeNull();
    expect(researchVehicle("Chevrolet", "  ")).toBeNull();
  });
});

describe("effectiveMetric", () => {
  it("lance em R$ só vale com um modelo escolhido", () => {
    expect(effectiveMetric({ metric: "price", vehicle: null })).toBe("ratio");
    expect(effectiveMetric({ metric: "price", vehicle: { brand: "FIAT", model: "UNO" } })).toBe("price");
    expect(effectiveMetric({ metric: "ratio", vehicle: { brand: "FIAT", model: "UNO" } })).toBe("ratio");
  });
});

describe("DEFAULT_RESEARCH_FILTERS", () => {
  it("começa em carros sem monta declarada, em % do valor de mercado", () => {
    expect(DEFAULT_RESEARCH_FILTERS).toEqual({
      category: "carros",
      condition: "sem-monta",
      vehicle: null,
      state: null,
      metric: "ratio",
    });
  });
});
