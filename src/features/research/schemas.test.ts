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
        anode: "2018",
        anoate: "2020",
        fonte: "superbid",
        kmate: "100000",
        medida: "price",
      }),
    ).toEqual({
      category: "motos",
      condition: "media",
      vehicle: { brand: "HONDA", model: "CG" },
      state: "GO",
      yearFrom: 2018,
      yearTo: 2020,
      source: "superbid",
      maxKm: 100_000,
      compare: null,
      metric: "price",
      sale: null,
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

  it("ano trocado inverte a faixa e ano inválido some", () => {
    const vehicle = { marca: "Fiat", modelo: "Uno" };
    expect(parseResearchParams({ ...vehicle, anode: "2020", anoate: "2018" })).toMatchObject({
      yearFrom: 2018,
      yearTo: 2020,
    });
    expect(parseResearchParams({ ...vehicle, anode: "abc", anoate: "20" })).toMatchObject({
      yearFrom: null,
      yearTo: null,
    });
  });

  it("lê a comparação com outro modelo e outro estado", () => {
    expect(
      parseResearchParams({ marca: "Fiat", modelo: "Uno", uf: "SP", vsmarca: "Hyundai", vsmodelo: "HB20", vsuf: "GO" })
        .compare,
    ).toEqual({ vehicle: { brand: "HYUNDAI", model: "HB20" }, state: "GO" });
  });

  it("comparação igual aos filtros, ou com outro modelo sem modelo escolhido, some", () => {
    expect(parseResearchParams({ marca: "Fiat", modelo: "Uno", vsmarca: "Fiat", vsmodelo: "Uno" }).compare).toBeNull();
    expect(parseResearchParams({ vsmarca: "Hyundai", vsmodelo: "HB20" }).compare).toBeNull();
    expect(parseResearchParams({ uf: "SP", vsuf: "SP" }).compare).toBeNull();
  });

  it("fonte com formato inválido e km fora das faixas viram ausentes", () => {
    expect(parseResearchParams({ fonte: "Super Bid!", kmate: "70000" })).toMatchObject({ source: null, maxKm: null });
  });

  it("venda só com id no formato de UUID", () => {
    expect(parseResearchParams({ venda: "0199C0DE-0000-7000-8000-000000000001" }).sale).toBe(
      "0199c0de-0000-7000-8000-000000000001",
    );
    expect(parseResearchParams({ venda: "1; drop table" }).sale).toBeNull();
  });

  it("ano sem modelo não filtra", () => {
    expect(parseResearchParams({ anode: "2018", anoate: "2020" })).toEqual(DEFAULT_RESEARCH_FILTERS);
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
      yearFrom: 2015,
      yearTo: null,
      source: "leilo",
      maxKm: 50_000,
      compare: { vehicle: { brand: "FIAT", model: "TORO" }, state: "BA" },
      metric: "price",
      sale: "0199c0de-0000-7000-8000-000000000001",
    };
    expect(parseResearchParams(researchParams(filters))).toEqual(filters);
  });
});
