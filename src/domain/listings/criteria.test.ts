import { describe, expect, it } from "vitest";

import { cents } from "../money";
import { isOpenAt, type ListingCriteria, type MatchableListing, matchesCriteria, searchTokens } from "./criteria";

const now = new Date("2026-09-27T12:00:00Z");

const anyCriteria: ListingCriteria = {
  search: null,
  yearFrom: null,
  yearTo: null,
  maxPrice: null,
  radiusKm: null,
  category: "todas",
  condition: "qualquer",
};

const fox: MatchableListing = {
  title: "VW/FOX 1.0 (4P)",
  brand: "VW",
  model: "FOX 1.0 (4P)",
  fipeName: "Fox City 1.0 Mi Total Flex 8V 5p",
  modelYear: 2012,
  category: "Carros",
  damageLevel: null,
  status: "open",
  endsAt: new Date("2026-09-30T13:00:00Z"),
  currentBid: null,
  minimumBid: cents(1_800_000),
  distanceKm: 40,
};

const matches = (criteria: Partial<ListingCriteria>, listing: Partial<MatchableListing> = {}) =>
  matchesCriteria({ ...anyCriteria, ...criteria }, { ...fox, ...listing }, now);

describe("searchTokens", () => {
  it("separa palavras, sem acento e em maiúsculas", () => {
    expect(searchTokens("  vw  Fóx ")).toEqual(["VW", "FOX"]);
    expect(searchTokens("HB20/Comfort")).toEqual(["HB20", "COMFORT"]);
    expect(searchTokens("")).toEqual([]);
    expect(searchTokens(null)).toEqual([]);
  });
});

describe("isOpenAt", () => {
  it("aberto só com situação aberta e fim no futuro ou desconhecido", () => {
    expect(isOpenAt(fox, now)).toBe(true);
    expect(isOpenAt({ status: "open", endsAt: null }, now)).toBe(true);
    expect(isOpenAt({ status: "open", endsAt: now }, now)).toBe(false);
    expect(isOpenAt({ status: "sold", endsAt: null }, now)).toBe(false);
  });
});

describe("matchesCriteria", () => {
  it("sem critério: qualquer anúncio aberto", () => {
    expect(matches({})).toBe(true);
    expect(matches({}, { status: "sold" })).toBe(false);
  });

  it("busca: todas as palavras, em qualquer ordem, em título, marca, modelo ou nome FIPE", () => {
    expect(matches({ search: "vw fox" })).toBe(true);
    expect(matches({ search: "fox vw" })).toBe(true);
    expect(matches({ search: "fox city" })).toBe(true);
    expect(matches({ search: "fox gol" })).toBe(false);
  });

  it("faixa de ano inclusiva; ano desconhecido não passa quando há faixa", () => {
    expect(matches({ yearFrom: 2011, yearTo: 2013 })).toBe(true);
    expect(matches({ yearFrom: 2012, yearTo: 2012 })).toBe(true);
    expect(matches({ yearFrom: 2013 })).toBe(false);
    expect(matches({ yearTo: 2011 })).toBe(false);
    expect(matches({ yearFrom: 2011 }, { modelYear: null })).toBe(false);
  });

  it("preço: lance atual ou, sem lance, o inicial", () => {
    expect(matches({ maxPrice: cents(1_800_000) })).toBe(true);
    expect(matches({ maxPrice: cents(1_799_999) })).toBe(false);
    expect(matches({ maxPrice: cents(2_000_000) }, { currentBid: cents(2_100_000) })).toBe(false);
    expect(matches({ maxPrice: cents(2_000_000) }, { currentBid: null, minimumBid: null })).toBe(false);
  });

  it("raio: distância conhecida e dentro do limite", () => {
    expect(matches({ radiusKm: 50 })).toBe(true);
    expect(matches({ radiusKm: 50 }, { distanceKm: 50.1 })).toBe(false);
    expect(matches({ radiusKm: 300 }, { distanceKm: null })).toBe(false);
    expect(matches({ radiusKm: null }, { distanceKm: null })).toBe(true);
  });

  it("categoria pelo grupo", () => {
    expect(matches({ category: "veiculos" })).toBe(true);
    expect(matches({ category: "motos" })).toBe(false);
    expect(matches({ category: "veiculos" }, { category: "Imoveis" })).toBe(false);
    expect(matches({ category: "veiculos" }, { category: null })).toBe(false);
  });

  it("condição: sem classificação conta como 'não informada'", () => {
    expect(matches({ condition: "sem-monta" })).toBe(true);
    expect(matches({ condition: "sem-monta" }, { damageLevel: "small" })).toBe(false);
    expect(matches({ condition: "ate-pequena" }, { damageLevel: "small" })).toBe(true);
    expect(matches({ condition: "ate-media" }, { damageLevel: "medium" })).toBe(true);
    expect(matches({ condition: "ate-media" }, { damageLevel: "salvage" })).toBe(false);
    expect(matches({ condition: "com-monta" })).toBe(false);
    expect(matches({ condition: "com-monta" }, { damageLevel: "large" })).toBe(true);
    expect(matches({ condition: "com-monta" }, { damageLevel: "salvage" })).toBe(false);
  });
});
