import { describe, expect, it } from "vitest";

import { watchInputSchema } from "./schemas";

const base = { name: "", search: "fox", distance: "150", condition: "qualquer" };

describe("watchInputSchema", () => {
  it("lê os critérios dos campos escondidos dos controles", () => {
    const parsed = watchInputSchema.parse({
      ...base,
      yearFrom: "2012",
      yearTo: "2015",
      minPrice: "5000,00",
      maxPrice: "30000,00",
      maxMarketPct: "60",
      maxMileageKm: "100000",
      distance: "todas",
      categories: "carros,outros",
      hide: "impedido,x",
      sources: "leilo,Fonte Ruim",
      origins: "financiamento",
      fuels: "flex",
      keyOnly: "1",
    });
    expect(parsed).toEqual({
      name: null,
      criteria: {
        search: "fox",
        yearFrom: 2012,
        yearTo: 2015,
        minPrice: 500_000,
        maxPrice: 3_000_000,
        maxMarketPct: 60,
        maxMileageKm: 100_000,
        radiusKm: null,
        categories: ["carros", "outros"],
        condition: "qualquer",
        hide: ["impedido"],
        sources: ["leilo"],
        origins: ["financiamento"],
        fuels: ["flex"],
        keyOnly: true,
      },
    });
  });

  it("sem categoria marcada: todas; opção fora da lista é ignorada", () => {
    const { criteria } = watchInputSchema.parse({ ...base, categories: "", maxMarketPct: "55" });
    expect(criteria).toMatchObject({ categories: null, maxMarketPct: null, radiusKm: 150, keyOnly: false });
  });

  it("exige um critério de veículo; o teto do mercado conta", () => {
    expect(watchInputSchema.safeParse({ ...base, search: "" }).success).toBe(false);
    expect(watchInputSchema.safeParse({ ...base, search: "", maxMarketPct: "60" }).success).toBe(true);
  });

  it("faixas invertidas são erro no campo final", () => {
    const years = watchInputSchema.safeParse({ ...base, yearFrom: "2015", yearTo: "2012" });
    expect(years.error?.issues[0]?.path).toEqual(["yearTo"]);
    const prices = watchInputSchema.safeParse({ ...base, minPrice: "300,00", maxPrice: "200,00" });
    expect(prices.error?.issues[0]?.path).toEqual(["maxPrice"]);
  });
});
