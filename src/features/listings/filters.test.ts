import { describe, expect, it } from "vitest";

import { DEFAULT_CATEGORIES, DEFAULT_CRITERIA } from "@/domain/listings/criteria";
import { cents } from "@/domain/money";

import { activeFilters, clearedFilters, compactBRL, priceRangeLabel, yearRangeLabel } from "./filter-labels";
import { listingParams, parseListingParams } from "./schemas";

describe("parseListingParams", () => {
  it("URL vazia: os padrões (150 km, carros, motos e utilitários, abertos, encerra primeiro)", () => {
    const filters = parseListingParams({});
    expect(filters.criteria).toEqual(DEFAULT_CRITERIA);
    expect(filters).toMatchObject({ ended: false, sort: "encerra", page: 1, endsWithin: null, analyzed: null });
  });

  it("listas por vírgula, só chaves conhecidas, na ordem canônica", () => {
    const { criteria } = parseListingParams({
      categoria: "motos,barcos,carros",
      ocultar: "airbag,impedido,x",
      origem: "seguradora",
      combustivel: "diesel,flex,flex",
      fonte: "leilo,Fonte Ruim,patio-sao-carlos",
    });
    expect(criteria).toMatchObject({
      categories: ["carros", "motos"],
      hide: ["impedido", "airbag"],
      origins: ["seguradora"],
      fuels: ["flex", "diesel"],
      sources: ["leilo", "patio-sao-carlos"],
    });
  });

  it("categoria: grupos antigos, 'todas' e lista inválida", () => {
    expect(parseListingParams({ categoria: "veiculos" }).criteria.categories).toEqual(DEFAULT_CATEGORIES);
    expect(parseListingParams({ categoria: "todas" }).criteria.categories).toBeNull();
    expect(parseListingParams({ categoria: "barcos" }).criteria.categories).toEqual(DEFAULT_CATEGORIES);
    expect(parseListingParams({ categoria: "pesados" }).criteria.categories).toEqual(["pesados"]);
  });

  it("preço em reais vira centavos; faixas invertidas são trocadas", () => {
    expect(parseListingParams({ precoDe: "30000", precoAte: "10000" }).criteria).toMatchObject({
      minPrice: 1_000_000,
      maxPrice: 3_000_000,
    });
    expect(parseListingParams({ anoDe: "2020", anoAte: "2015" }).criteria).toMatchObject({
      yearFrom: 2015,
      yearTo: 2020,
    });
  });

  it("preço em reais acima do teto int4 é ignorado sem erro", () => {
    expect(parseListingParams({ precoAte: "30000000", precoDe: "21474837" }).criteria).toMatchObject({
      minPrice: null,
      maxPrice: null,
    });
    expect(parseListingParams({ precoAte: "21474836" }).criteria.maxPrice).toBe(2_147_483_600);
  });

  it("opções fora da lista viram o padrão; prazo some nos encerrados", () => {
    const filters = parseListingParams({ mercado: "55", kmAte: "100000", encerra: "48h", ordem: "x" });
    expect(filters.criteria).toMatchObject({ maxMarketPct: null, maxMileageKm: 100_000 });
    expect(filters).toMatchObject({ endsWithin: "48h", sort: "encerra" });
    expect(parseListingParams({ encerra: "48h", situacao: "encerrados" }).endsWithin).toBeNull();
  });

  it("parâmetro repetido: vale o primeiro", () => {
    expect(parseListingParams({ busca: ["fox", "gol"] }).criteria.search).toBe("fox");
  });
});

describe("listingParams", () => {
  it("padrões ficam fora da URL", () => {
    expect(listingParams(parseListingParams({}))).toEqual({});
    expect(listingParams(parseListingParams({ categoria: "veiculos", distancia: "150", pagina: "3" }))).toEqual({});
  });

  it("é o inverso de parseListingParams", () => {
    const raw = {
      busca: "fox",
      anoDe: "2012",
      anoAte: "2015",
      precoDe: "5000",
      precoAte: "30000",
      mercado: "60",
      kmAte: "100000",
      distancia: "todas",
      categoria: "carros,outros",
      condicao: "sem-monta",
      ocultar: "impedido,laudo-reprovado",
      fonte: "leilo",
      origem: "financiamento,frota",
      combustivel: "flex",
      chave: "1",
      lances: "sem",
      encerra: "24h",
      novos: "1",
      analisados: "esconder",
      ordem: "mercado",
    };
    expect(listingParams(parseListingParams(raw))).toEqual(raw);
    expect(listingParams(parseListingParams({ categoria: "todas", situacao: "encerrados" }))).toEqual({
      categoria: "todas",
      situacao: "encerrados",
    });
  });
});

describe("rótulos", () => {
  it("preço compacto", () => {
    expect(compactBRL(80_000)).toBe("R$ 800");
    expect(compactBRL(3_000_000)).toBe("R$ 30 mil");
    expect(compactBRL(750_000)).toBe("R$ 7,5 mil");
  });

  it("faixas de preço e ano", () => {
    const none = { minPrice: null, maxPrice: null };
    expect(priceRangeLabel(none)).toBeNull();
    expect(priceRangeLabel({ ...none, maxPrice: cents(3_000_000) })).toBe("Até R$ 30 mil");
    expect(priceRangeLabel({ minPrice: cents(500_000), maxPrice: cents(3_000_000) })).toBe("R$ 5 mil a R$ 30 mil");
    expect(yearRangeLabel({ yearFrom: 2015, yearTo: 2020 })).toBe("2015–2020");
    expect(yearRangeLabel({ yearFrom: 2015, yearTo: 2015 })).toBe("2015");
    expect(yearRangeLabel({ yearFrom: null, yearTo: 2020 })).toBe("Até 2020");
  });
});

describe("activeFilters", () => {
  it("padrões não viram chip", () => {
    expect(activeFilters(parseListingParams({}), {})).toEqual([]);
  });

  it("um chip por filtro, e o '×' tira só aquele", () => {
    const filters = parseListingParams({ busca: "fox", fonte: "leilo,freitas", precoAte: "30000", pagina: "4" });
    const chips = activeFilters(filters, { leilo: "Leilo" });
    expect(chips.map((chip) => chip.label)).toEqual(["“fox”", "Até R$ 30 mil", "Leilo", "freitas"]);
    const withoutLeilo = chips[2]?.without;
    expect(withoutLeilo?.criteria.sources).toEqual(["freitas"]);
    expect(withoutLeilo?.criteria.search).toBe("fox");
    expect(withoutLeilo?.page).toBe(1);
  });

  it("'Limpar tudo' mantém situação e ordem", () => {
    const filters = parseListingParams({ busca: "fox", situacao: "encerrados", ordem: "novos", novos: "1" });
    const cleared = clearedFilters(filters);
    expect(activeFilters(cleared, {})).toEqual([]);
    expect(cleared).toMatchObject({ ended: true, sort: "novos" });
  });
});
