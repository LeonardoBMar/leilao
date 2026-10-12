import { describe, expect, it } from "vitest";

import { type FacetGroups, facetsFromGroups, matchSuggestions } from "./facets";

const empty: FacetGroups = { categories: [], sources: [], origins: [], fuels: [], vehicles: [] };

describe("facetsFromGroups", () => {
  it("leva os grupos do banco às chaves da tela, com zero nas que não apareceram", () => {
    const facets = facetsFromGroups({
      ...empty,
      categories: [
        { category: "Carros", count: 3 },
        { category: "Motos", count: 1 },
        // Fora do vocabulário e sem categoria caem juntos em "outros".
        { category: "Diversos", count: 2 },
        { category: null, count: 1 },
      ],
      sources: [
        { sourceId: "leilo", count: 2 },
        { sourceId: "patio", count: 5 },
      ],
      origins: [{ origin: "seguradora", count: 4 }],
    });
    expect(facets.categories).toEqual({ carros: 3, motos: 1, utilitarios: 0, pesados: 0, sucatas: 0, outros: 3 });
    expect(facets.sources).toEqual({ leilo: 2, patio: 5 });
    expect(facets.origins).toEqual({ financiamento: 0, seguradora: 4, frota: 0, orgao_publico: 0, outros: 0 });
  });

  it("combustível: soma as grafias de cada chave e ignora as não reconhecidas", () => {
    const facets = facetsFromGroups({
      ...empty,
      fuels: [
        { fuel: "Flex", count: 2 },
        { fuel: "ÁLCOOL/GASOLINA", count: 1 },
        { fuel: "DIESEL", count: 1 },
        { fuel: "???", count: 7 },
        { fuel: null, count: 3 },
      ],
    });
    expect(facets.fuels).toEqual({ flex: 3, gasolina: 0, diesel: 1, eletrico: 0 });
  });

  it("sugestões: marca e marca + primeira palavra do modelo, somadas e das mais frequentes", () => {
    const facets = facetsFromGroups({
      ...empty,
      vehicles: [
        { brand: "VW", model: "FOX 1.0", count: 2 },
        { brand: "VW", model: "FOX CONNECT", count: 1 },
        { brand: "HONDA", model: "CG 160 FAN", count: 1 },
        { brand: null, model: "SEM MARCA", count: 9 },
      ],
    });
    expect(facets.suggestions).toEqual([
      { label: "VW", count: 3 },
      { label: "VW FOX", count: 3 },
      { label: "HONDA", count: 1 },
      { label: "HONDA CG", count: 1 },
    ]);
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
