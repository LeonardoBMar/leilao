import { describe, expect, it } from "vitest";

import { DEFAULT_EVALUATE_FILTERS } from "@/domain/research/evaluate";
import { DEFAULT_RESEARCH_FILTERS, type ResearchFilters } from "@/domain/research/filters";

import { evaluateParams, parseEvaluateParams, parseResearchParams, researchParams } from "./schemas";

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
        periodo: "90",
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
      period: 90,
      sale: null,
    } satisfies ResearchFilters);
  });

  it("valor inválido vira o padrão, sem erro", () => {
    expect(
      parseResearchParams({
        categoria: "pesados",
        condicao: "x",
        uf: "ZZ",
        medida: "y",
        marca: "   ",
        modelo: "Onix",
        periodo: "7",
      }),
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
      period: 30,
      sale: "0199c0de-0000-7000-8000-000000000001",
    };
    expect(parseResearchParams(researchParams(filters))).toEqual(filters);
  });
});

describe("parseEvaluateParams", () => {
  const lot = "0b9c3c1e-7f0a-4a52-9d2e-2b1c0c5d9e11";
  const sale = "6f1e2d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f";

  it("sem parâmetros, o padrão", () => {
    expect(parseEvaluateParams({})).toEqual(DEFAULT_EVALUATE_FILTERS);
  });

  it("lê o recorte, normaliza o modelo e só aceita família do mesmo modelo", () => {
    expect(
      parseEvaluateParams({
        marca: "Chevrolet",
        modelo: "Onix Plus",
        familia: "CHEVROLET|ONIX|PLUS",
        versao: "004450-1",
        anode: "2024",
        anoate: "2022",
        kmate: "50000",
        condicao: "media",
        origem: "financiamento",
        lote: lot.toUpperCase(),
        fora: `${sale}, ${sale},xyz`,
      }),
    ).toEqual({
      vehicle: { brand: "CHEVROLET", model: "ONIX" },
      family: "CHEVROLET|ONIX|PLUS",
      version: "004450-1",
      yearFrom: 2022,
      yearTo: 2024,
      maxKm: 50_000,
      condition: "media",
      origin: "financiamento",
      lot,
      excluded: [sale],
    });
    expect(parseEvaluateParams({ marca: "Fiat", modelo: "Uno", familia: "CHEVROLET|ONIX|PLUS" }).family).toBeNull();
  });

  it("valores inválidos viram o padrão e família, versão e ano exigem modelo", () => {
    expect(
      parseEvaluateParams({
        familia: "CHEVROLET|ONIX|PLUS",
        versao: "004450-1",
        anode: "2020",
        condicao: "xyz",
        origem: "marte",
        lote: "1",
        kmate: "123",
      }),
    ).toEqual(DEFAULT_EVALUATE_FILTERS);
    expect(parseEvaluateParams({ marca: "Fiat", modelo: "Uno", versao: "4450" }).version).toBeNull();
  });

  it("guarda até 50 vendas excluídas", () => {
    const ids = Array.from({ length: 60 }, (_, n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
    expect(parseEvaluateParams({ fora: ids.join(",") }).excluded).toHaveLength(50);
  });
});

describe("evaluateParams", () => {
  it("é o inverso de parseEvaluateParams, sem os padrões", () => {
    const params = {
      marca: "CHEVROLET",
      modelo: "ONIX",
      familia: "CHEVROLET|ONIX|PLUS",
      anode: "2022",
      anoate: "2024",
      condicao: "pequena",
      origem: "frota",
      fora: "6f1e2d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f",
    };
    expect(evaluateParams(parseEvaluateParams(params))).toEqual(params);
    expect(evaluateParams(DEFAULT_EVALUATE_FILTERS)).toEqual({});
  });
});
