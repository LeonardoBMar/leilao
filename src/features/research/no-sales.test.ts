import { describe, expect, it } from "vitest";

import { DEFAULT_RESEARCH_FILTERS, type ResearchFilters } from "@/domain/research/filters";

import { noSalesSuggestions } from "./no-sales";
import type { ResearchFacets } from "./types";

const facets: ResearchFacets = {
  conditions: { "sem-monta": 0, pequena: 48, media: 12, grande: 0, sucata: 0 },
  categories: { carros: 60, motos: 0, utilitarios: 0, sucatas: 0 },
  states: { SP: 30, SC: 10 },
  sources: [
    { id: "superbid", name: "Superbid", sales: 50 },
    { id: "leilo", name: "Leilo", sales: 10 },
  ],
  mileage: { total: 60, known: 20 },
  years: [
    { year: 2021, sales: 4 },
    { year: 2018, sales: 6 },
  ],
  models: [],
};

const filters = (changes: Partial<ResearchFilters>): ResearchFilters => ({ ...DEFAULT_RESEARCH_FILTERS, ...changes });

describe("noSalesSuggestions", () => {
  it("sem filtro a afrouxar, só oferece a condição com mais vendas", () => {
    const [only, ...rest] = noSalesSuggestions(filters({}), facets);
    expect(rest).toEqual([]);
    expect(only?.label).toBe("Ver pequena monta (48 vendas)");
    expect(only?.filters.condition).toBe("pequena");
  });

  it("com estado, oferece o Brasil todo com a soma dos estados", () => {
    const [first] = noSalesSuggestions(filters({ state: "AC" }), facets);
    expect(first?.label).toBe("Ver o Brasil todo (40 vendas)");
    expect(first?.filters.state).toBeNull();
  });

  it("com modelo e faixa de ano, tira o ano antes de largar o modelo", () => {
    const vehicle = { brand: "FIAT", model: "UNO" };
    const labels = noSalesSuggestions(filters({ vehicle, yearFrom: 2010, yearTo: 2012 }), facets).map(
      (suggestion) => suggestion.label,
    );
    expect(labels).toEqual([
      "Tirar a faixa de ano (10 vendas)",
      "Ver todos os modelos",
      "Ver pequena monta (48 vendas)",
    ]);
  });

  it("com fonte e km, oferece todas as fontes e tirar o limite de km", () => {
    const labels = noSalesSuggestions(filters({ source: "freitas", maxKm: 50_000 }), facets).map(
      (suggestion) => suggestion.label,
    );
    expect(labels).toEqual([
      "Ver todas as fontes (60 vendas)",
      "Tirar o limite de km (60 vendas)",
      "Ver pequena monta (48 vendas)",
    ]);
  });

  it("sem vendas em lugar nenhum, não oferece saída", () => {
    const empty: ResearchFacets = {
      ...facets,
      conditions: { "sem-monta": 0, pequena: 0, media: 0, grande: 0, sucata: 0 },
      states: {},
      years: [],
    };
    expect(noSalesSuggestions(filters({ state: "AC" }), empty)).toEqual([]);
  });

  it("nunca passa de três saídas", () => {
    const vehicle = { brand: "FIAT", model: "UNO" };
    expect(noSalesSuggestions(filters({ vehicle, state: "AC", yearFrom: 2010 }), facets)).toHaveLength(3);
  });
});
