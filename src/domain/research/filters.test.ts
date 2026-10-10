import { describe, expect, it } from "vitest";

import {
  comparisonGroups,
  DEFAULT_RESEARCH_FILTERS,
  effectiveMetric,
  groupLabel,
  normalizeComparison,
  normalizeYears,
  researchVehicle,
  vehicleLabel,
} from "./filters";

describe("researchVehicle", () => {
  it("agrupa como as estimativas: marca por extenso e primeira palavra do modelo", () => {
    expect(researchVehicle("Chevrolet", "Onix Plus LTZ")).toEqual({ brand: "CHEVROLET", model: "ONIX" });
    expect(researchVehicle("VW", "gol 1.0")).toEqual({ brand: "VOLKSWAGEN", model: "GOL" });
    expect(researchVehicle("Mercedes-Benz", "C 180")).toEqual({ brand: "MERCEDES BENZ", model: "C-180" });
    expect(researchVehicle("VW", "T Cross")).toEqual({ brand: "VOLKSWAGEN", model: "T-CROSS" });
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
      yearFrom: null,
      yearTo: null,
      compare: null,
      metric: "ratio",
    });
  });
});

describe("vehicleLabel", () => {
  it("inicial maiúscula nas palavras, número e sigla de marca em maiúsculas", () => {
    expect(vehicleLabel({ brand: "CHEVROLET", model: "ONIX" })).toBe("Chevrolet Onix");
    expect(vehicleLabel({ brand: "MERCEDES BENZ", model: "C-180" })).toBe("Mercedes Benz C-180");
    expect(vehicleLabel({ brand: "VOLKSWAGEN", model: "T-CROSS" })).toBe("Volkswagen T-Cross");
    expect(vehicleLabel({ brand: "HYUNDAI", model: "HB20" })).toBe("Hyundai HB20");
    expect(vehicleLabel({ brand: "BMW", model: "X1" })).toBe("BMW X1");
    expect(vehicleLabel({ brand: "PEUGEOT", model: "207" })).toBe("Peugeot 207");
    expect(vehicleLabel({ brand: "HONDA", model: "HR-V" })).toBe("Honda HR-V");
  });
});

describe("normalizeYears", () => {
  it.each([
    [2018, 2020, { yearFrom: 2018, yearTo: 2020 }],
    [2020, 2018, { yearFrom: 2018, yearTo: 2020 }],
    [2018, null, { yearFrom: 2018, yearTo: null }],
    [null, 2020, { yearFrom: null, yearTo: 2020 }],
    [null, null, { yearFrom: null, yearTo: null }],
    [1800, 2020, { yearFrom: null, yearTo: 2020 }],
    [2018.5, 3000, { yearFrom: null, yearTo: null }],
  ])("de %s até %s", (from, to, expected) => {
    expect(normalizeYears(from, to)).toEqual(expected);
  });
});

describe("normalizeComparison", () => {
  const onix = { brand: "CHEVROLET", model: "ONIX" };
  const hb20 = { brand: "HYUNDAI", model: "HB20" };

  it("sem comparação, nada", () => {
    expect(normalizeComparison({ vehicle: onix, state: null }, null)).toBeNull();
  });

  it("compara com outro modelo quando há um modelo escolhido", () => {
    expect(normalizeComparison({ vehicle: onix, state: null }, { vehicle: hb20, state: null })).toEqual({
      vehicle: hb20,
      state: null,
    });
  });

  it("outro modelo sem modelo escolhido não vale", () => {
    expect(normalizeComparison({ vehicle: null, state: null }, { vehicle: hb20, state: null })).toBeNull();
  });

  it("o mesmo modelo ou o mesmo estado não é comparação", () => {
    expect(normalizeComparison({ vehicle: onix, state: "SP" }, { vehicle: onix, state: "SP" })).toBeNull();
  });

  it("compara dois estados, e o Brasil todo com um estado", () => {
    expect(normalizeComparison({ vehicle: null, state: "SP" }, { vehicle: null, state: "GO" })).toEqual({
      vehicle: null,
      state: "GO",
    });
    expect(normalizeComparison({ vehicle: null, state: null }, { vehicle: null, state: "GO" })).toEqual({
      vehicle: null,
      state: "GO",
    });
  });
});

describe("comparisonGroups", () => {
  const onix = { brand: "CHEVROLET", model: "ONIX" };
  const hb20 = { brand: "HYUNDAI", model: "HB20" };

  it("sem comparação, não há dois grupos", () => {
    expect(comparisonGroups(DEFAULT_RESEARCH_FILTERS)).toBeNull();
  });

  it("o segundo grupo troca só o que a comparação traz", () => {
    const groups = comparisonGroups({
      ...DEFAULT_RESEARCH_FILTERS,
      vehicle: onix,
      state: "SP",
      compare: { vehicle: hb20, state: null },
    });
    expect(groups?.map(({ vehicle, state }) => [vehicle, state])).toEqual([
      [onix, "SP"],
      [hb20, "SP"],
    ]);
  });
});

describe("groupLabel", () => {
  it("junta modelo e estado, e sem nenhum dos dois é o Brasil", () => {
    expect(groupLabel({ vehicle: { brand: "CHEVROLET", model: "ONIX" }, state: "SP" })).toBe(
      "Chevrolet Onix · São Paulo",
    );
    expect(groupLabel({ vehicle: null, state: "GO" })).toBe("Goiás");
    expect(groupLabel({ vehicle: null, state: null })).toBe("Brasil");
  });
});
