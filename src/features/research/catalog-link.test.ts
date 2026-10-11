import { describe, expect, it } from "vitest";

import { DEFAULT_EVALUATE_FILTERS } from "@/domain/research/evaluate";
import { DEFAULT_RESEARCH_FILTERS } from "@/domain/research/filters";
import { parseListingParams } from "@/features/listings/schemas";

import { catalogParams, evaluateCatalogParams } from "./catalog-link";

const onix = { brand: "CHEVROLET", model: "ONIX" };

describe("catalogParams", () => {
  it("sem modelo escolhido, não há o que buscar", () => {
    expect(catalogParams(DEFAULT_RESEARCH_FILTERS)).toBeNull();
  });

  it("leva o modelo, a categoria, a condição e a faixa de ano, em qualquer distância", () => {
    expect(
      catalogParams({ ...DEFAULT_RESEARCH_FILTERS, vehicle: onix, condition: "pequena", yearFrom: 2018, yearTo: 2020 }),
    ).toEqual({
      busca: "Chevrolet Onix",
      categoria: "carros",
      condicao: "ate-pequena",
      anoDe: "2018",
      anoAte: "2020",
      distancia: "todas",
    });
  });

  it("leva o km máximo e a fonte", () => {
    expect(
      catalogParams({ ...DEFAULT_RESEARCH_FILTERS, vehicle: onix, maxKm: 100_000, source: "leilo" }),
    ).toMatchObject({
      kmAte: "100000",
      fonte: "leilo",
    });
  });

  it("sucata não vira com-monta, que não a inclui: fica sem filtro de condição", () => {
    const params = catalogParams({ ...DEFAULT_RESEARCH_FILTERS, vehicle: onix, condition: "sucata" });
    expect(params?.condicao).toBe("qualquer");
  });

  it("não leva o estado: o catálogo filtra por distância", () => {
    expect(catalogParams({ ...DEFAULT_RESEARCH_FILTERS, vehicle: onix, state: "SP" })).not.toHaveProperty("uf");
  });

  it("o catálogo entende os parâmetros que a Pesquisa monta", () => {
    const params = catalogParams({ ...DEFAULT_RESEARCH_FILTERS, vehicle: onix, category: "motos", yearFrom: 2019 });
    const filters = parseListingParams(params ?? {});
    expect(filters.criteria).toMatchObject({
      search: "Chevrolet Onix",
      categories: ["motos"],
      yearFrom: 2019,
      radiusKm: null,
    });
  });
});

describe("evaluateCatalogParams", () => {
  it("sem modelo, nada", () => {
    expect(evaluateCatalogParams(DEFAULT_EVALUATE_FILTERS)).toBeNull();
  });

  it("busca pela família quando há, com condição, ano, km e origem, em qualquer categoria", () => {
    const params = evaluateCatalogParams({
      ...DEFAULT_EVALUATE_FILTERS,
      vehicle: onix,
      family: "CHEVROLET|ONIX|PLUS",
      version: "004450-1",
      yearFrom: 2022,
      yearTo: 2024,
      maxKm: 100_000,
      origin: "financiamento",
    });
    expect(params).toEqual({
      busca: "Chevrolet ONIX PLUS",
      categoria: "todas",
      condicao: "sem-monta",
      anoDe: "2022",
      anoAte: "2024",
      kmAte: "100000",
      origem: "financiamento",
      distancia: "todas",
    });
    expect(parseListingParams(params ?? {}).criteria).toMatchObject({
      search: "Chevrolet ONIX PLUS",
      categories: null,
      origins: ["financiamento"],
    });
  });
});
