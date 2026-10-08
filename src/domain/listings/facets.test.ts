import { describe, expect, it } from "vitest";

import { DEFAULT_CRITERIA, type FacetCriteria, type FacetListing } from "./criteria";
import { computeFacets, matchSuggestions } from "./facets";

const row = (overrides: Partial<FacetListing> = {}): FacetListing => ({
  sourceId: "leilo",
  title: "VW/FOX 1.0",
  brand: "VW",
  model: "FOX 1.0",
  fipeName: null,
  category: "Carros",
  recoveryType: "Recuperado de Financiamento",
  fuel: "Flex",
  ...overrides,
});

const none: FacetCriteria = { search: null, categories: null, sources: [], origins: [], fuels: [] };

const rows = [
  row(),
  row({ sourceId: "patio", brand: "HONDA", model: "CG 160 FAN", title: "HONDA CG 160", category: "Motos" }),
  row({ sourceId: "patio", recoveryType: "SEGURADORA", fuel: "DIESEL", category: "Pesados", brand: "FORD" }),
  row({ category: null, fuel: null, brand: null }),
];

describe("computeFacets", () => {
  it("sem filtro de faceta: conta todos os anúncios em cada chip", () => {
    const facets = computeFacets(rows, none);
    expect(facets.categories).toEqual({ carros: 1, motos: 1, utilitarios: 0, pesados: 1, sucatas: 0, outros: 1 });
    expect(facets.sources).toEqual({ leilo: 2, patio: 2 });
    expect(facets.origins).toEqual({ financiamento: 3, seguradora: 1, frota: 0, outros: 0 });
    expect(facets.fuels).toEqual({ flex: 2, gasolina: 0, diesel: 1, eletrico: 0 });
  });

  it("cada faceta conta com as outras aplicadas e sem ela mesma", () => {
    const facets = computeFacets(rows, { ...none, sources: ["patio"], categories: ["motos"] });
    // Categorias: só a fonte vale (2 do Pátio, uma moto e um pesado).
    expect(facets.categories).toMatchObject({ motos: 1, pesados: 1, carros: 0 });
    // Fontes: só a categoria vale (a moto é do Pátio).
    expect(facets.sources).toEqual({ patio: 1 });
  });

  it("sugestões: marca e marca + primeira palavra do modelo, das mais frequentes, sem a própria busca", () => {
    const facets = computeFacets([...rows, row()], { ...none, search: "fox" });
    expect(facets.suggestions.slice(0, 2)).toEqual([
      { label: "VW", count: 2 },
      { label: "VW FOX", count: 2 },
    ]);
    expect(facets.suggestions.map((suggestion) => suggestion.label)).toContain("HONDA CG");
  });

  it("aceita os critérios padrão", () => {
    expect(computeFacets(rows, DEFAULT_CRITERIA).categories.pesados).toBe(1);
  });
});

describe("matchSuggestions", () => {
  const suggestions = [
    { label: "FORD", count: 10 },
    { label: "FORD KA", count: 6 },
    { label: "FIAT", count: 8 },
    { label: "VW FOX", count: 2 },
  ];

  it("todas as palavras, a última pela metade; o que começa pelo texto vem primeiro", () => {
    expect(matchSuggestions(suggestions, "fo").map((suggestion) => suggestion.label)).toEqual([
      "FORD",
      "FORD KA",
      "VW FOX",
    ]);
    expect(matchSuggestions(suggestions, "ford k").map((suggestion) => suggestion.label)).toEqual(["FORD KA"]);
  });

  it("não sugere o que já está digitado nem sem texto", () => {
    expect(matchSuggestions(suggestions, "ford ka")).toEqual([]);
    expect(matchSuggestions(suggestions, "  ")).toEqual([]);
  });
});
