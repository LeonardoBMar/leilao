import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { listingContractProblems } from "../shared/contract";
import type { FetchOutcome, SourceHttp } from "../types";
import { superbidSource } from ".";
import {
  buildSuperbidListing,
  parseSuperbidList,
  parseSuperbidOffer,
  parseSuperbidTitle,
  SUPERBID_CATEGORY_IDS,
  SUPERBID_PAGE_SIZE,
  superbidDetailsFromRaw,
  superbidListingUrl,
  superbidListUrl,
  superbidOfferApiUrl,
  type SuperbidRaw,
} from "./parse";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const now = new Date("2026-10-10T19:00:00Z");

const OFFERS = {
  car: { file: "lote-aberto-carro.json", id: "5054700" },
  moto: { file: "lote-aberto-moto.json", id: "5054677" },
  sold: { file: "lote-vendido.json", id: "5044378" },
  soldTitleOnly: { file: "lote-vendido-hasta.json", id: "5050334" },
  conditional: { file: "lote-condicional.json", id: "5051100" },
  unsold: { file: "lote-sem-lance.json", id: "5040886" },
  withdrawn: { file: "lote-retirado.json", id: "5046765" },
  pending: { file: "lote-status-11.json", id: "5045979" },
  damaged: { file: "lote-sinistrado.json", id: "5042734" },
} as const;
type OfferKey = keyof typeof OFFERS;

function raw(key: OfferKey): SuperbidRaw {
  const { file, id } = OFFERS[key];
  const parsed = parseSuperbidOffer(fixture(file), id);
  if (!parsed.ok || parsed.value === null) throw new Error(`${file}: oferta não reconhecida`);
  return parsed.value;
}

function listing(key: OfferKey) {
  const value = buildSuperbidListing(raw(key), now);
  const { id } = OFFERS[key];
  expect(listingContractProblems(value, { externalId: id, url: superbidListingUrl(id) })).toEqual([]);
  return value;
}

describe("parseSuperbidList", () => {
  it("lê os ids da página e o total da consulta", () => {
    expect(parseSuperbidList(fixture("lista-motos.json"), now)).toEqual({
      ok: true,
      value: { ids: ["5054677", "5054676", "5054674"], total: 3331, count: 3 },
    });
  });

  it("deixa de fora oferta já encerrada e leilão de teste", () => {
    const json = JSON.stringify({
      total: 4,
      offers: [
        { id: 1, endDateTime: now.getTime() + 60_000, manager: { id: 9 } },
        { id: 2, endDateTime: now.getTime() - 60_000, manager: { id: 9 } },
        { id: 3, endDateTime: now.getTime() + 60_000, manager: { id: 114 } },
        { id: 4, endDateTime: null },
      ],
    });
    expect(parseSuperbidList(json, now)).toEqual({ ok: true, value: { ids: ["1", "4"], total: 4, count: 4 } });
  });

  it("resposta fora do formato é erro", () => {
    expect(parseSuperbidList("<html>", now)).toEqual({ ok: false, error: "missing_data" });
    expect(parseSuperbidList('{"total":1,"offers":[{"id":"x"}]}', now)).toEqual({ ok: false, error: "invalid_data" });
  });
});

describe("parseSuperbidOffer", () => {
  it("oferta que a API não conhece é nula; oferta de outro id é erro", () => {
    expect(parseSuperbidOffer(fixture("lote-inexistente.json"), "1")).toEqual({ ok: true, value: null });
    expect(parseSuperbidOffer(fixture(OFFERS.car.file), "1")).toEqual({ ok: false, error: "invalid_data" });
    expect(parseSuperbidOffer('{"erro":true}', "1")).toEqual({ ok: false, error: "missing_data" });
  });

  it("não guarda quem está vencendo nem telefones do vendedor", () => {
    for (const { file, id } of Object.values(OFFERS)) {
      const parsed = parseSuperbidOffer(fixture(file), id);
      expect(JSON.stringify(parsed)).not.toMatch(/currentWinner|phone/);
    }
    expect(raw("sold").hasWinner).toBe(true);
    expect(raw("unsold").hasWinner).toBe(false);
  });

  it("apaga placa completa, chassi e Renavam do título e da descrição", () => {
    // Valores fictícios no lugar dos que o leiloeiro escreve.
    const text = fixture(OFFERS.car.file)
      .replace(
        /"shortDesc": "(?:[^"\\]|\\.)*"/,
        '"shortDesc": "HONDA HR-V EX HS, 2024/2025, Placa ABC1D23, CH.: 9BWAB45U0LT000001"',
      )
      .replace(
        /"detailedDescription": "(?:[^"\\]|\\.)*"/,
        '"detailedDescription": "<p>Marca: HONDA</p><p>Placa: ABC-1D23</p><p>Chassi: 9BWAB45U0LT000001</p><p>Renavam: 12345678901</p><p>Obs.: chassi 9BWAB45U0LT000001 remarcado</p>"',
      );
    const parsed = parseSuperbidOffer(text, OFFERS.car.id);
    if (!parsed.ok || parsed.value === null) throw new Error("oferta não reconhecida");
    expect(JSON.stringify(parsed.value)).not.toMatch(/ABC-?1D23|9BWAB45U0LT000001|12345678901/);
    expect(parsed.value.description).toEqual([
      "Marca: HONDA",
      "Placa: [removido]",
      "Renavam: [removido]",
      "Obs.: chassi [removido] remarcado",
    ]);
    expect(buildSuperbidListing(parsed.value, now).title).toBe("HONDA HR-V EX HS, 2024/2025");
  });
});

describe("buildSuperbidListing", () => {
  it("lote aberto de carro: ficha rotulada, lance, comissão, local e fotos", () => {
    expect(listing("car")).toMatchObject({
      externalId: "5054700",
      url: "https://exchange.superbid.net/oferta/5054700",
      title: "HONDA HR-V EX HS, 2024/2025",
      vehicle: {
        brand: "HONDA",
        model: "HR-V EX HS",
        manufactureYear: 2024,
        modelYear: 2025,
        mileageKm: 18_624,
        fuel: "ALCOOL/GASOLINA",
        color: "PRETA",
        category: "Carros",
      },
      auction: { externalId: "797580", name: "Motiva CCR", startsAt: new Date("2026-10-15T14:00:00Z") },
      sellerName: "MOTIVA INFRAESTRUTURA DE MOBILIDADE S.A.",
      status: "open",
      sourceStatus: "1",
      currentBid: 7_200_000,
      minimumBid: 6_500_000,
      bidCount: 8,
      marketValue: null,
      endsAt: new Date("2026-10-15T14:05:30Z"),
      location: { city: "Jundiaí", state: "SP" },
      costs: { commissionRate: 500 },
    });
    expect(listing("car").photoUrls[0]).toMatch(/^https:\/\/ms\.sbwebservices\.net\/photos\//);
  });

  it("texto padrão e negações da descrição não viram marcações", () => {
    // "Rastreador e GNV não/não aplicável" na HR-V; "airbags acionados ou ausentes" no edital da CR-V.
    expect(listing("car").condition.flags).toEqual([]);
    expect(listing("conditional").condition).toMatchObject({ damageLevel: "medium", flags: [] });
  });

  it("lote aberto de moto sem lance: despesas de estadia e remoção", () => {
    expect(listing("moto")).toMatchObject({
      title: "HONDA NXR160 BROS ESDD 2018/2018",
      vehicle: { brand: "HONDA", model: "NXR160 BROS ESDD", modelYear: 2018, category: "Motos" },
      currentBid: null,
      minimumBid: 500_000,
      bidCount: 0,
      location: { city: "Alvorada", state: "RS" },
      costs: { commissionRate: 500, storageFee: 37_716, removalFee: 57_822, otherFees: null },
    });
  });

  it("situação pelo código: 3 vendido, 7 condicional, 6 não vendido ou retirado, outro desconhecido", () => {
    expect(listing("sold")).toMatchObject({ status: "sold", sourceStatus: "3", currentBid: 15_500_000, bidCount: 20 });
    expect(listing("conditional")).toMatchObject({ status: "conditional", sourceStatus: "7", currentBid: 3_525_000 });
    expect(listing("unsold")).toMatchObject({ status: "unsold", sourceStatus: "6", currentBid: null });
    expect(listing("withdrawn")).toMatchObject({ status: "withdrawn", sourceStatus: "6" });
    expect(listing("pending")).toMatchObject({ status: "unknown", sourceStatus: "11", currentBid: 30_750_000 });
  });

  it("código desconhecido antes do fim segue aberto", () => {
    const future = { ...raw("pending"), endsAt: "2026-10-20T12:00:00.000Z" };
    expect(buildSuperbidListing(future, now).status).toBe("open");
  });

  it("vendido sem lance ou condicional sem vencedor não têm desfecho confiável", () => {
    expect(buildSuperbidListing({ ...raw("sold"), bidCount: 0 }, now).status).toBe("unknown");
    expect(buildSuperbidListing({ ...raw("conditional"), hasWinner: false }, now).status).toBe("unknown");
  });

  it("picape e utilitário entram como Utilitarios", () => {
    expect(listing("sold").vehicle).toMatchObject({
      brand: "CHEVROLET",
      model: "S10 LTZ DD4A",
      category: "Utilitarios",
    });
    expect(listing("pending").vehicle).toMatchObject({ brand: "M.BENZ", modelYear: 2024, manufactureYear: 2023 });
  });

  it("sem ficha rotulada, marca, modelo e anos saem do título", () => {
    expect(listing("soldTitleOnly").vehicle).toMatchObject({
      brand: "HYUNDAI",
      model: "IX35 B",
      manufactureYear: 2013,
      modelYear: 2014,
    });
    expect(listing("unsold").vehicle).toMatchObject({ brand: "LAND ROVER", fuel: "DIESEL" });
  });

  it("marca e modelo da API; ano e modelo rotulados em linhas separadas", () => {
    expect(listing("damaged").vehicle).toMatchObject({
      brand: "VOLKSWAGEN",
      model: "VOYAGE",
      manufactureYear: 2021,
      modelYear: 2022,
      color: "CINZA",
    });
    expect(listing("damaged").costs.storageFee).toBe(550_000);
  });

  it("ficha numa linha separada por barras", () => {
    expect(listing("withdrawn").vehicle).toMatchObject({
      brand: "FIAT",
      model: "PALIO FIRE FLEX",
      manufactureYear: 2008,
      modelYear: 2008,
      color: "BRANCA",
    });
  });

  it("descrição sem a linha de chassi", () => {
    expect(listing("car").description).not.toMatch(/Chassi/i);
    expect(listing("car").description).toContain("Quilometragem acima de: 18624");
  });
});

describe("parseSuperbidTitle", () => {
  it.each([
    ["HONDA HR-V EX HS, 2024/2025, Placa FINAL 3 (SP),", "HONDA", "HR-V EX HS", 2024, 2025, false],
    ["BMW   F800 R 2016 2017 AZUL", "BMW", "F800 R", 2016, 2017, false],
    ["Honda CR-V LX 2.0 2011", "HONDA", "CR-V LX 2.0", null, 2011, false],
    // "VW" vira "VOLKSWAGEN" nas estimativas e no casamento da FIPE (BRAND_ALIASES).
    ["VW/VOYAGE 1.6", "VW", "VOYAGE 1.6", null, null, false],
    ["Veículo Fiat Palio Fire Flex ano/modelo: 2008", "FIAT", "PALIO FIRE FLEX", null, 2008, false],
    ["MERCEDES BENZ GLE450 D 4M 2023/2024", "MERCEDES BENZ", "GLE450 D 4M", 2023, 2024, false],
    ["SUCATA DE FIAT MOBI LIKE, 2021/2021, Placa FINAL 7 (MG),", "FIAT", "MOBI LIKE", 2021, 2021, true],
    ["HONDA CG 150 2009 2010 Sucata Motor Servível", "HONDA", "CG 150", 2009, 2010, true],
    ["Chevrolet - Onix 1.4MT LT 2015/2016 Flex", "CHEVROLET", "ONIX 1.4MT LT", 2015, 2016, false],
    [
      "FIAT IDEA ADVENTURE 1.8 DUALOGIC ANO 2014 / MODELO 2015 ID: #3840726",
      "FIAT",
      "IDEA ADVENTURE 1.8 DUALOGIC",
      2014,
      2015,
      false,
    ],
    ["FIAT / PALIO FIRE, ANO: 2008 / 2009", "FIAT", "PALIO FIRE", 2008, 2009, false],
    ["LOTE COM 15 SCOOTERS ELÉTRICAS BOLT MODELO SP-001, 1200W", null, null, null, null, false],
  ])("%s", (title, brand, model, manufactureYear, modelYear, salvage) => {
    expect(parseSuperbidTitle(title)).toEqual({
      brand,
      model,
      years: { manufactureYear, modelYear },
      salvage,
      heavy: false,
    });
  });

  it("ônibus e caminhão no começo do título são Pesados", () => {
    expect(parseSuperbidTitle("MICRO-ÔNIBUS IVECO CITYCLASS 70C17 ANO 2014 / MODELO 2014")).toEqual({
      brand: "IVECO",
      model: "CITYCLASS 70C17",
      years: { manufactureYear: 2014, modelYear: 2014 },
      salvage: false,
      heavy: true,
    });
  });
});

describe("superbidDetailsFromRaw", () => {
  it("rederiva situação, descrição e condição do dado guardado", () => {
    const value = listing("conditional");
    expect(superbidDetailsFromRaw(raw("conditional"), now)).toEqual({
      description: value.description,
      condition: value.condition,
      status: "conditional",
      sourceStatus: "7",
    });
    expect(superbidDetailsFromRaw({ outro: true }, now)).toBeNull();
  });
});

function fakeHttp(responses: Record<string, FetchOutcome>) {
  const calls: string[] = [];
  const http: SourceHttp = {
    get: (url) => {
      calls.push(url);
      return Promise.resolve(responses[url] ?? { ok: false, status: 404, error: "HTTP 404" });
    },
    post: () => Promise.reject(new Error("o adaptador não usa POST")),
  };
  return { http, calls };
}

const page = (ids: number[], total: number): FetchOutcome => ({
  ok: true,
  text: JSON.stringify({ total, offers: ids.map((id) => ({ id, endDateTime: now.getTime() + 3_600_000 })) }),
});

describe("superbidSource", () => {
  it("pagina Carros e Motos; página curta é a última", async () => {
    const full = Array.from({ length: SUPERBID_PAGE_SIZE }, (_, index) => 1_000_000 + index);
    const { http, calls } = fakeHttp({
      [superbidListUrl(SUPERBID_CATEGORY_IDS.cars, 1)]: page(full, SUPERBID_PAGE_SIZE + 1),
      [superbidListUrl(SUPERBID_CATEGORY_IDS.cars, 2)]: page([2_000_000], SUPERBID_PAGE_SIZE + 1),
      [superbidListUrl(SUPERBID_CATEGORY_IDS.motorcycles, 1)]: { ok: true, text: fixture("lista-motos.json") },
    });
    const discovery = await superbidSource.discover(http, now);
    expect(calls).toEqual([
      superbidListUrl(SUPERBID_CATEGORY_IDS.cars, 1),
      superbidListUrl(SUPERBID_CATEGORY_IDS.cars, 2),
      superbidListUrl(SUPERBID_CATEGORY_IDS.motorcycles, 1),
    ]);
    expect(discovery.complete).toBe(true);
    expect(discovery.listings).toHaveLength(SUPERBID_PAGE_SIZE + 4);
    expect(discovery.listings).toContainEqual({
      externalId: "5054677",
      url: "https://exchange.superbid.net/oferta/5054677",
      lastModified: null,
    });
  });

  it("categoria que falha deixa a descoberta incompleta, sem perder a outra", async () => {
    const { http } = fakeHttp({
      [superbidListUrl(SUPERBID_CATEGORY_IDS.cars, 1)]: { ok: false, status: 503, error: "HTTP 503" },
      [superbidListUrl(SUPERBID_CATEGORY_IDS.motorcycles, 1)]: { ok: true, text: fixture("lista-motos.json") },
    });
    const discovery = await superbidSource.discover(http, now);
    expect(discovery.complete).toBe(false);
    expect(discovery.errors).toEqual([{ url: superbidListUrl(SUPERBID_CATEGORY_IDS.cars, 1), error: "HTTP 503" }]);
    expect(discovery.listings).toHaveLength(3);
  });

  it("lê a oferta pelo id; oferta desconhecida é página fora do ar", async () => {
    const { http, calls } = fakeHttp({
      [superbidOfferApiUrl("5044378")]: { ok: true, text: fixture(OFFERS.sold.file) },
      [superbidOfferApiUrl("1")]: { ok: true, text: fixture("lote-inexistente.json") },
    });
    const sold = await superbidSource.fetchListing(http, "5044378", now);
    expect(sold.ok && sold.value.status).toBe("sold");
    expect(calls).toEqual([superbidOfferApiUrl("5044378")]);
    expect(await superbidSource.fetchListing(http, "1", now)).toEqual({
      ok: false,
      gone: true,
      error: "oferta desconhecida pela API",
    });
  });

  it("id fora do formato não vai à API; falha de rede não é fora do ar", async () => {
    const { http, calls } = fakeHttp({});
    expect(await superbidSource.fetchListing(http, "abc", now)).toMatchObject({ ok: false, gone: false });
    expect(calls).toEqual([]);
    expect(await superbidSource.fetchListing(http, "5044378", now)).toEqual({
      ok: false,
      gone: false,
      error: "HTTP 404",
    });
  });

  it("consultas pedem só lotes abertos de leilão, da categoria, com os campos mínimos", () => {
    const url = new URL(superbidListUrl(SUPERBID_CATEGORY_IDS.motorcycles, 3));
    expect(url.origin).toBe("https://offer-query.superbid.net");
    expect(url.searchParams.get("filter")).toBe(
      "product.productType.id:10;statusId:1;auction.modalityId:1;product.subCategory.category.id:10012",
    );
    expect(url.searchParams.get("fieldList")).toBe("id;endDateTime;manager");
    expect(url.searchParams.get("orderBy")).toBe("id:desc");
    expect(url.searchParams.get("pageNumber")).toBe("3");
    expect(new URL(superbidOfferApiUrl("5044378")).searchParams.get("filter")).toBe("id:5044378");
  });
});
