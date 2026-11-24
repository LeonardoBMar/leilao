import { describe, expect, it } from "vitest";

import { cents } from "../money";
import {
  categoryKeyOf,
  criteriaFromStored,
  criteriaToStored,
  fuelOf,
  isOpenAt,
  type ListingCriteria,
  listingSearchText,
  marketRatioBps,
  type MatchableListing,
  matchesCriteria,
  searchTokens,
} from "./criteria";

const now = new Date("2026-09-27T12:00:00Z");

const anyCriteria: ListingCriteria = {
  search: null,
  yearFrom: null,
  yearTo: null,
  minPrice: null,
  maxPrice: null,
  maxMarketPct: null,
  maxMileageKm: null,
  radiusKm: null,
  categories: null,
  condition: "qualquer",
  hide: [],
  sources: [],
  origins: [],
  fuels: [],
  keyOnly: false,
};

const fox: MatchableListing = {
  sourceId: "leilo",
  title: "VW/FOX 1.0 (4P)",
  brand: "VW",
  model: "FOX 1.0 (4P)",
  fipeName: "Fox City 1.0 Mi Total Flex 8V 5p",
  modelYear: 2012,
  mileageKm: 90_000,
  category: "Carros",
  fuel: "Flex",
  origin: "financiamento",
  hasKey: true,
  damageLevel: null,
  conditionFlags: [],
  inspection: null,
  status: "open",
  endsAt: new Date("2026-09-30T13:00:00Z"),
  currentBid: null,
  minimumBid: cents(1_800_000),
  marketValue: cents(3_000_000),
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

describe("listingSearchText", () => {
  it("normaliza título, marca, modelo e FIPE sem acento para paridade com a busca", () => {
    expect(
      listingSearchText({
        title: "Citroën C3 Tendânce 1.5",
        brand: "Citroën",
        model: "C3",
        fipeName: "Caminhão Furgão Mégane",
      }),
    ).toBe("CITROEN C3 TENDANCE 1 5 CITROEN C3 CAMINHAO FURGAO MEGANE");
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

  it("faixa de preço: mínimo e máximo inclusivos", () => {
    expect(matches({ minPrice: cents(1_800_000) })).toBe(true);
    expect(matches({ minPrice: cents(1_800_001) })).toBe(false);
    expect(matches({ minPrice: cents(100) }, { currentBid: null, minimumBid: null })).toBe(false);
  });

  it("% do mercado: preço até X% do valor de mercado; sem valor de mercado não passa", () => {
    expect(matches({ maxMarketPct: 60 })).toBe(true);
    expect(matches({ maxMarketPct: 50 })).toBe(false);
    expect(matches({ maxMarketPct: 80 }, { marketValue: null })).toBe(false);
  });

  it("quilometragem máxima; km desconhecida não passa", () => {
    expect(matches({ maxMileageKm: 100_000 })).toBe(true);
    expect(matches({ maxMileageKm: 50_000 })).toBe(false);
    expect(matches({ maxMileageKm: 100_000 }, { mileageKm: null })).toBe(false);
  });

  it("categorias múltiplas; 'outros' cobre as demais e a categoria vazia", () => {
    expect(matches({ categories: ["carros", "motos"] })).toBe(true);
    expect(matches({ categories: ["motos"] })).toBe(false);
    expect(matches({ categories: ["outros"] }, { category: "Imoveis" })).toBe(true);
    expect(matches({ categories: ["outros"] }, { category: null })).toBe(true);
    expect(matches({ categories: [] })).toBe(false);
  });

  it("fonte, origem e combustível: vazio aceita todos", () => {
    expect(matches({ sources: ["leilo"] })).toBe(true);
    expect(matches({ sources: ["freitas"] })).toBe(false);
    expect(matches({ origins: ["financiamento"] })).toBe(true);
    expect(matches({ origins: ["seguradora", "frota"] })).toBe(false);
    expect(matches({ fuels: ["flex", "diesel"] })).toBe(true);
    expect(matches({ fuels: ["gasolina"] })).toBe(false);
    expect(matches({ fuels: ["flex"] }, { fuel: null })).toBe(false);
  });

  it("só com chave: chave desconhecida não passa", () => {
    expect(matches({ keyOnly: true })).toBe(true);
    expect(matches({ keyOnly: true }, { hasKey: null })).toBe(false);
    expect(matches({ keyOnly: true }, { hasKey: false })).toBe(false);
  });

  it("esconde alertas da condição e laudo reprovado", () => {
    expect(matches({ hide: ["impedido", "laudo-reprovado"] })).toBe(true);
    expect(matches({ hide: ["impedido"] }, { conditionFlags: ["circulation_banned"] })).toBe(false);
    expect(matches({ hide: ["remarcado"] }, { conditionFlags: ["circulation_banned"] })).toBe(true);
    expect(matches({ hide: ["airbag"] }, { conditionFlags: ["airbag_deployed"] })).toBe(false);
    expect(matches({ hide: ["laudo-reprovado"] }, { inspection: "rejected" })).toBe(false);
    expect(matches({ hide: ["laudo-reprovado"] }, { inspection: "approved_with_notes" })).toBe(true);
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

describe("categoryKeyOf", () => {
  it("categorias com chave própria e o resto em 'outros'", () => {
    expect(categoryKeyOf("Utilitarios")).toBe("utilitarios");
    expect(categoryKeyOf("Equipamentos")).toBe("outros");
    expect(categoryKeyOf(null)).toBe("outros");
  });
});

describe("fuelOf", () => {
  it("normaliza as grafias das fontes e não adivinha", () => {
    expect(fuelOf("Flex")).toBe("flex");
    expect(fuelOf("GASOL/ALC")).toBe("flex");
    expect(fuelOf("FLEXIVEL ALCOOL/GASOLINA")).toBe("flex");
    expect(fuelOf("Álcool / Etanol")).toBe("flex");
    expect(fuelOf("Gasolina / Álcool / GNV")).toBe("flex");
    expect(fuelOf("GASOLINA")).toBe("gasolina");
    expect(fuelOf("Gas")).toBe("gasolina");
    expect(fuelOf("DIESEL")).toBe("diesel");
    expect(fuelOf("Gasolina / Elétrico")).toBe("eletrico");
    expect(fuelOf("HIBRIDO")).toBe("eletrico");
    expect(fuelOf("ELETR/FONTE EXT")).toBe("eletrico");
    expect(fuelOf("SUCATA S/ DIREITO A DOCUMENTO")).toBeNull();
    expect(fuelOf(null)).toBeNull();
  });
});

describe("marketRatioBps", () => {
  it("preço sobre valor de mercado, arredondado; sem dado ou mercado zero: nulo", () => {
    expect(marketRatioBps(cents(1_800_000), cents(3_000_000))).toBe(6_000);
    expect(marketRatioBps(cents(1), cents(3))).toBe(3_333);
    expect(marketRatioBps(null, cents(3_000_000))).toBeNull();
    expect(marketRatioBps(cents(100), cents(0))).toBeNull();
  });
});

describe("criteriaFromStored / criteriaToStored", () => {
  it("ida e volta preservam os critérios; lista vazia de categorias é 'todas'", () => {
    const criteria: ListingCriteria = {
      ...anyCriteria,
      minPrice: cents(500_000),
      categories: ["carros", "outros"],
      hide: ["airbag"],
      origins: ["financiamento"],
      fuels: ["flex"],
      keyOnly: true,
    };
    expect(criteriaFromStored(criteriaToStored(criteria))).toEqual(criteria);
    expect(criteriaFromStored(criteriaToStored(anyCriteria)).categories).toBeNull();
  });

  it("chave desconhecida gravada é descartada", () => {
    const stored = {
      ...criteriaToStored(anyCriteria),
      categories: ["carros", "barcos"],
      condition: "x",
      fuels: ["gnv"],
    };
    expect(criteriaFromStored(stored)).toMatchObject({ categories: ["carros"], condition: "qualquer", fuels: [] });
  });
});
