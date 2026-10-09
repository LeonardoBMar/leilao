import { describe, expect, it } from "vitest";

import { DEFAULT_RESEARCH_FILTERS, type ResearchFilters } from "@/domain/research/filters";

import { parseResearchParams, researchParams } from "./schemas";

describe("parseResearchParams", () => {
  it("sem parâmetros, o padrão", () => {
    expect(parseResearchParams({})).toEqual(DEFAULT_RESEARCH_FILTERS);
  });

  it("lê os filtros e normaliza marca e modelo como as estimativas", () => {
    expect(
      parseResearchParams({
        categoria: "motos",
        condicao: "media",
        marca: "Honda",
        modelo: "CG 160 Fan",
        uf: "go",
        medida: "price",
      }),
    ).toEqual({
      category: "motos",
      condition: "media",
      vehicle: { brand: "HONDA", model: "CG" },
      state: "GO",
      metric: "price",
    } satisfies ResearchFilters);
  });

  it("valor inválido vira o padrão, sem erro", () => {
    expect(
      parseResearchParams({ categoria: "pesados", condicao: "x", uf: "ZZ", medida: "y", marca: "   ", modelo: "Onix" }),
    ).toEqual(DEFAULT_RESEARCH_FILTERS);
  });

  it("modelo sem marca não filtra", () => {
    expect(parseResearchParams({ modelo: "Onix" }).vehicle).toBeNull();
  });

  it("parâmetro repetido: vale o primeiro", () => {
    expect(parseResearchParams({ uf: ["SP", "GO"] }).state).toBe("SP");
  });
});

describe("researchParams", () => {
  it("omite os padrões", () => {
    expect(researchParams(DEFAULT_RESEARCH_FILTERS)).toEqual({});
  });

  it("é o inverso da leitura", () => {
    const filters: ResearchFilters = {
      category: "utilitarios",
      condition: "pequena",
      vehicle: { brand: "FIAT", model: "STRADA" },
      state: "CE",
      metric: "price",
    };
    expect(parseResearchParams(researchParams(filters))).toEqual(filters);
  });
});
