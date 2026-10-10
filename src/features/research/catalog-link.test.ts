import { describe, expect, it } from "vitest";

import { DEFAULT_RESEARCH_FILTERS } from "@/domain/research/filters";
import { parseListingParams } from "@/features/listings/schemas";

import { catalogParams } from "./catalog-link";

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
