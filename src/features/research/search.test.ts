import { describe, expect, it } from "vitest";

import { DEFAULT_RESEARCH_FILTERS } from "@/domain/research/filters";

import { matchModels, researchHref } from "./search";

describe("researchHref", () => {
  it("sem filtros fora do padrão, só o caminho", () => {
    expect(researchHref(DEFAULT_RESEARCH_FILTERS)).toBe("/pesquisa");
    expect(researchHref({ ...DEFAULT_RESEARCH_FILTERS, vehicle: { brand: "FIAT", model: "UNO" }, state: "SP" })).toBe(
      "/pesquisa?marca=FIAT&modelo=UNO&uf=SP",
    );
  });
});

describe("matchModels", () => {
  const options = [
    { brand: "CHEVROLET", model: "ONIX" },
    { brand: "VOLKSWAGEN", model: "GOL" },
    { brand: "FIAT", model: "UNO" },
  ];

  it("cada palavra começa uma palavra da marca, da sigla ou do modelo", () => {
    expect(matchModels(options, "oni")).toEqual([options[0]]);
    expect(matchModels(options, "vw g")).toEqual([options[1]]);
    expect(matchModels(options, "Fiat Ônix")).toEqual([]);
  });

  it("sem texto, os mais vendidos", () => {
    expect(matchModels(options, "  ", 2)).toEqual(options.slice(0, 2));
  });
});
