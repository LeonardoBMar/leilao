import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { listingContractProblems } from "../shared/contract";
import type { FetchOutcome, SourceHttp } from "../types";
import { leilaoOnlineSource } from ".";
import {
  buildLeilaoOnlineListing,
  categoryOfName,
  LEILAO_ONLINE_CATEGORY_URL,
  leilaoOnlineAuctionUrl,
  leilaoOnlineDetailsFromRaw,
  leilaoOnlineListingUrl,
  parseLeilaoOnlineAuctionPage,
  parseLeilaoOnlineCategory,
  parseLeilaoOnlineLotPage,
  parseLeilaoOnlineTitle,
  splitBrandModel,
} from "./parse";
import type { LeilaoOnlineRaw } from "./schema";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const now = new Date("2026-10-09T23:00:00Z");
const cars = { id: "2", name: "Carros" };

function lot(name: string, category: LeilaoOnlineRaw["category"] = cars): LeilaoOnlineRaw {
  const page = parseLeilaoOnlineLotPage(fixture(name));
  if (!page) throw new Error(`${name}: página não reconhecida`);
  return { ...page, category };
}

function listing(name: string, category: LeilaoOnlineRaw["category"] = cars) {
  const raw = lot(name, category);
  const value = buildLeilaoOnlineListing(raw, now);
  expect(listingContractProblems(value, { externalId: raw.lotId, url: leilaoOnlineListingUrl(raw.lotId) })).toEqual([]);
  return value;
}

describe("parseLeilaoOnlineCategory", () => {
  it("lê os leilões abertos da categoria, sem repetir", () => {
    expect(parseLeilaoOnlineCategory(fixture("categoria-carros.html"))?.sort()).toEqual([
      "4744",
      "4752",
      "4754",
      "4757",
    ]);
  });

  it("categoria vazia só com o aviso do site; sem lista e sem aviso é `null`", () => {
    const empty = fixture("categoria-vazia.html");
    expect(parseLeilaoOnlineCategory(empty)).toEqual([]);
    expect(parseLeilaoOnlineCategory(empty.replace("não existem leilões em andamento", "aguarde"))).toBeNull();
  });
});

describe("parseLeilaoOnlineAuctionPage", () => {
  it("lê os lotes da página, a última página e as categorias do filtro", () => {
    const first = parseLeilaoOnlineAuctionPage(fixture("leilao-4757-p1.html"), "4757");
    expect(first?.lotIds).toHaveLength(20);
    expect(first?.lotIds[0]).toBe("336882");
    expect(first?.lastPage).toBe(3);
    expect(first?.categories).toEqual([cars, { id: "1", name: "Motos" }]);

    const last = parseLeilaoOnlineAuctionPage(fixture("leilao-4757-p3.html"), "4757");
    expect(last?.lotIds).toHaveLength(1);
    expect(last?.lastPage).toBe(3);
  });

  it("filtro por categoria devolve só os lotes dela", () => {
    const all = parseLeilaoOnlineAuctionPage(fixture("leilao-4754.html"), "4754");
    expect(all?.lotIds).toHaveLength(6);
    expect(all?.categories.map((category) => category.name)).toEqual(["Caminhões", "Carros", "Diversos"]);
    expect(parseLeilaoOnlineAuctionPage(fixture("leilao-4754-caminhoes.html"), "4754")?.lotIds).toEqual([
      "336766",
      "336767",
    ]);
  });

  it("página que não é deste leilão (redirecionamento) é `null`", () => {
    expect(parseLeilaoOnlineAuctionPage(fixture("leilao-4754.html"), "4757")).toBeNull();
    expect(parseLeilaoOnlineAuctionPage(fixture("inicio.html"), "4757")).toBeNull();
  });
});

describe("parseLeilaoOnlineTitle", () => {
  it("separa marca, modelo, anos, cor, combustível, km e FIPE aproximada", () => {
    expect(
      parseLeilaoOnlineTitle(
        "VW/VIRTUS MB; 2024/2025; BRANCA; ALCO./GASOL. - FUNC. - IPVA 2026 OK - APROX. 4.600KM - FIPE APROX.: R$ 95.793,00",
        now,
      ),
    ).toEqual({
      name: "VW/VIRTUS MB",
      brand: "VW",
      model: "VIRTUS MB",
      manufactureYear: 2024,
      modelYear: 2025,
      color: "BRANCA",
      fuel: "ALCO./GASOL.",
      mileageKm: 4600,
      marketValue: 9_579_300,
    });
  });

  it("moto com ano só, caminhão com tipo, cor e combustível rotulados", () => {
    expect(parseLeilaoOnlineTitle("BMW K1200 LT; ANO 2002 - FUNCIONANDO - APROX. 79.350KM", now)).toMatchObject({
      brand: "BMW",
      model: "K1200 LT",
      manufactureYear: 2002,
      modelYear: 2002,
      color: null,
      fuel: null,
      mileageKm: 79_350,
    });
    expect(
      parseLeilaoOnlineTitle(
        "CAMINHÃO VOLVO/NH12380 4X2T; 2002/2003; COR BRANCA; COMB. DIESEL - SUCATA SEM DIREITO A DOCUMENTAÇÃO",
        now,
      ),
    ).toMatchObject({ brand: "VOLVO", model: "NH12380 4X2T", color: "BRANCA", fuel: "DIESEL", marketValue: null });
  });

  it("caminhões: 'ANO' antes dos anos, sem cor, travessão e tipo antes da marca", () => {
    expect(
      parseLeilaoOnlineTitle(
        "CAMINHÃO VW/17.280 CONSTELLATION; ANO 2014/2015; DIESEL; AUTOMÁTICO; 3 EIXOS (TRUCKADO EQUIVALENTE AO 24.280) - FUNCIONANDO",
        now,
      ),
    ).toMatchObject({ brand: "VW", model: "17.280 CONSTELLATION", modelYear: 2015, color: null, fuel: "DIESEL" });
    expect(
      parseLeilaoOnlineTitle(
        "CAMINHÃO M. BENZ/ L 1620; ANO 2007/2008; COR BRANCA; COMB. DIESEL – FUNCIONANDO – IPVA 2026 OK",
        now,
      ),
    ).toMatchObject({ brand: "MERCEDES-BENZ", model: "L 1620", modelYear: 2008, color: "BRANCA", fuel: "DIESEL" });
    expect(
      parseLeilaoOnlineTitle("CAMINHÃO MUNCK TRUCKADO GMC 14.190; ANO 1999/2000; COMB. DIESEL", now),
    ).toMatchObject({ brand: "GMC", model: "14.190", modelYear: 2000, color: null, fuel: "DIESEL" });
    expect(
      parseLeilaoOnlineTitle(
        "CAMINHÃO TRATOR DAF/XF FTT 530 HR; ANO 2024/2024; COR BRANCA; COMB. DIESEL - FUNC. - FIPE APROX. R$ 695.600,00",
        now,
      ),
    ).toMatchObject({ brand: "DAF", modelYear: 2024, marketValue: 69_560_000 });
    expect(
      parseLeilaoOnlineTitle(
        "CAMINHÃO VW 8.160; ANO 2014/2015; C/ CARROCERIA - FUNCIONANDO - CÓD. PÁTIO I20 - FIPE APROX. R$ 205.000,00",
        now,
      ),
    ).toMatchObject({ brand: "VW", model: "8.160", color: null, fuel: null, marketValue: 20_500_000 });
  });

  it("marca: importado, sem barra, abreviações e tipo antes da marca", () => {
    expect(splitBrandModel("I/FORD FOCUS 1.6 FLEX HA")).toEqual({ brand: "FORD", model: "FOCUS 1.6 FLEX HA" });
    expect(splitBrandModel("IMP/VW GOLF GLX 2.0 MI")).toEqual({ brand: "VW", model: "GOLF GLX 2.0 MI" });
    expect(splitBrandModel("FIAT UNO MILLE ELECTRONI")).toEqual({ brand: "FIAT", model: "UNO MILLE ELECTRONI" });
    expect(splitBrandModel("CHEV/ONIX 10MT LT2")).toEqual({ brand: "CHEVROLET", model: "ONIX 10MT LT2" });
    expect(splitBrandModel("MMC/L200 SPORT 4X4 HPE")).toEqual({ brand: "MITSUBISHI", model: "L200 SPORT 4X4 HPE" });
    expect(splitBrandModel("CAMINHÃO PIPA M. BENZ/LK 1513")).toEqual({ brand: "MERCEDES-BENZ", model: "LK 1513" });
    expect(splitBrandModel("MOTO JTZ/DK160")).toEqual({ brand: "JTZ", model: "DK160" });
  });
});

describe("categoryOfName", () => {
  it("traduz o filtro do site; Diversos e nomes novos ficam sem categoria", () => {
    expect(categoryOfName("Carros")).toBe("Carros");
    expect(categoryOfName("Motos")).toBe("Motos");
    expect(categoryOfName("Caminhões")).toBe("Pesados");
    expect(categoryOfName("Diversos")).toBeNull();
    expect(categoryOfName("Utilitários")).toBeNull();
  });
});

describe("buildLeilaoOnlineListing", () => {
  it("lote aberto: dados do título, condição, local de retirada, fotos e comissão", () => {
    const value = listing("lote-aberto.html");
    expect(value).toMatchObject({
      externalId: "336882",
      lotNumber: "3",
      title: "TOYOTA/ETIOS HB X 13L MT",
      vehicle: {
        brand: "TOYOTA",
        model: "ETIOS HB X 13L MT",
        manufactureYear: 2016,
        modelYear: 2017,
        color: "PRATA",
        fuel: "ALCO./GASOL.",
        category: "Carros",
      },
      auction: { externalId: "4757", name: "Leilão de 14/10/2026", startsAt: new Date("2026-10-14T18:00:00Z") },
      sellerName: "P. FÍSICA",
      condition: { damageLevel: null, flags: ["prior_claim"] },
      endsAt: new Date("2026-10-14T18:00:00Z"),
      location: { city: "SÃO PAULO", state: "SP" },
      status: "open",
      sourceStatus: "Aguardando",
      currentBid: null,
      minimumBid: 1_000_000,
      bidCount: 0,
      costs: { commissionRate: 500 },
    });
    expect(value.description).toMatch(/^FUNCIONANDO AIR BAG AUSENTE; LOTE ÚNICO/);
    expect(value.description).not.toMatch(/FRAUDAR/);
    expect(value.photoUrls).toHaveLength(19);
    expect(value.photoUrls[0]).toBe("https://d1y4blh5egbvru.cloudfront.net/img/leiloes/4757/lotes/336882/4%20(1).jpg");
  });

  it("vendido: o último lance é o preço final; o fim é a hora do último lance", () => {
    expect(listing("lote-vendido.html")).toMatchObject({
      status: "sold",
      sourceStatus: "Vendido",
      currentBid: 6_500_000,
      bidCount: 32,
      endsAt: new Date("2026-10-06T18:31:25Z"),
      auction: { startsAt: new Date("2026-10-06T18:00:00Z") },
      condition: { damageLevel: "medium", flags: ["prior_claim"] },
    });
  });

  it("venda condicional, em Leme/SP", () => {
    expect(listing("lote-condicional.html")).toMatchObject({
      status: "conditional",
      sourceStatus: "Venda condicional",
      currentBid: 3_125_000,
      location: { city: "LEME", state: "SP" },
    });
  });

  it("não vendido, com e sem lance", () => {
    expect(listing("lote-nao-vendido.html")).toMatchObject({
      status: "unsold",
      currentBid: 6_250_000,
      bidCount: 35,
      vehicle: { brand: "HONDA", model: "HR-V EXL CVT", mileageKm: 28_800 },
    });
    expect(listing("lote-sem-lance.html")).toMatchObject({
      status: "unsold",
      currentBid: null,
      bidCount: 0,
      endsAt: new Date("2026-10-09T18:00:00Z"),
    });
  });

  it("caminhão sucata e moto", () => {
    expect(listing("lote-caminhao.html", { id: "3", name: "Caminhões" })).toMatchObject({
      vehicle: { brand: "VOLVO", category: "Pesados" },
      condition: { damageLevel: "salvage" },
      sellerName: "OUTROS",
    });
    expect(listing("lote-moto.html", { id: "1", name: "Motos" })).toMatchObject({
      vehicle: { brand: "BMW", category: "Motos", modelYear: 2002, mileageKm: 79_350 },
    });
  });

  it("não guarda quem deu lance", () => {
    const raw = JSON.stringify(lot("lote-vendido.html"));
    expect(raw).not.toMatch(/\*\*\*/);
  });

  it("situação desconhecida: aberta antes do pregão, desconhecida depois", () => {
    const raw = { ...lot("lote-aberto.html"), statusCode: 9 };
    expect(buildLeilaoOnlineListing(raw, now).status).toBe("open");
    expect(buildLeilaoOnlineListing(raw, new Date("2026-10-15T12:00:00Z")).status).toBe("unknown");
  });
});

describe("leilaoOnlineDetailsFromRaw", () => {
  it("rederiva descrição, condição e situação do dado guardado", () => {
    expect(leilaoOnlineDetailsFromRaw(lot("lote-vendido.html"), now)).toMatchObject({
      status: "sold",
      sourceStatus: "Vendido",
      condition: { damageLevel: "medium" },
    });
    expect(leilaoOnlineDetailsFromRaw({ outro: "formato" }, now)).toBeNull();
  });
});

function fakeHttp(pages: Record<string, string>) {
  const calls: string[] = [];
  const http: SourceHttp = {
    get(url) {
      calls.push(url);
      const text = pages[url];
      const outcome: FetchOutcome =
        text === undefined ? { ok: false, status: 404, error: "HTTP 404" } : { ok: true, text };
      return Promise.resolve(outcome);
    },
    post: () => Promise.resolve({ ok: false, status: 405, error: "HTTP 405" }),
  };
  return { http, calls };
}

const auction4754 = {
  [leilaoOnlineAuctionUrl("4754", 1)]: fixture("leilao-4754.html"),
  [leilaoOnlineAuctionUrl("4754", 1, "2")]: fixture("leilao-4754-carros.html"),
  [leilaoOnlineAuctionUrl("4754", 1, "3")]: fixture("leilao-4754-caminhoes.html"),
  [leilaoOnlineAuctionUrl("4754", 1, "29")]: fixture("leilao-4754-diversos.html"),
};

describe("leilaoOnlineSource", () => {
  it("descoberta: categoria + lista de cada leilão; leilão que falha deixa a descoberta incompleta", async () => {
    const { http } = fakeHttp({ [LEILAO_ONLINE_CATEGORY_URL]: fixture("categoria-carros.html"), ...auction4754 });
    const discovery = await leilaoOnlineSource.discover(http, now);
    expect(discovery.complete).toBe(false);
    expect(discovery.errors).toHaveLength(3);
    expect(discovery.listings.map((item) => item.externalId).sort()).toEqual([
      "336763",
      "336764",
      "336765",
      "336766",
      "336767",
      "336769",
    ]);
  });

  it("categoria fora do ar ou fora do formato: descoberta incompleta", async () => {
    const { http } = fakeHttp({});
    expect(await leilaoOnlineSource.discover(http, now)).toMatchObject({ complete: false, listings: [] });

    const changed = fixture("categoria-vazia.html").replace("não existem leilões em andamento", "aguarde");
    const { http: other } = fakeHttp({ [LEILAO_ONLINE_CATEGORY_URL]: changed });
    expect(await leilaoOnlineSource.discover(other, now)).toMatchObject({ complete: false, listings: [] });

    const { http: empty } = fakeHttp({ [LEILAO_ONLINE_CATEGORY_URL]: fixture("categoria-vazia.html") });
    expect(await leilaoOnlineSource.discover(empty, now)).toEqual({ listings: [], complete: true, errors: [] });
  });

  it("lote: página + categoria pela lista filtrada, lida uma vez por execução", async () => {
    const page = fixture("lote-aberto.html").replaceAll("336882", "336766").replaceAll('value="4757"', 'value="4754"');
    const { http, calls } = fakeHttp({ [leilaoOnlineListingUrl("336766")]: page, ...auction4754 });
    const first = await leilaoOnlineSource.fetchListing(http, "336766", now);
    expect(first.ok && first.value.vehicle.category).toBe("Pesados");
    const listCalls = calls.length;
    await leilaoOnlineSource.fetchListing(http, "336766", now);
    expect(calls.length).toBe(listCalls + 1);
  });

  it("categoria já guardada: não lê a lista do leilão", async () => {
    const { http, calls } = fakeHttp({ [leilaoOnlineListingUrl("336589")]: fixture("lote-vendido.html") });
    const stored = lot("lote-vendido.html", { id: "2", name: "Carros" });
    const fetched = await leilaoOnlineSource.fetchListing(http, "336589", now, stored);
    expect(fetched.ok && fetched.value).toMatchObject({ status: "sold", vehicle: { category: "Carros" } });
    expect(calls).toEqual([leilaoOnlineListingUrl("336589")]);
  });

  it("lista do leilão fora do ar: lote sem categoria, sem falhar", async () => {
    const { http } = fakeHttp({ [leilaoOnlineListingUrl("336589")]: fixture("lote-vendido.html") });
    const fetched = await leilaoOnlineSource.fetchListing(http, "336589", now);
    expect(fetched.ok && fetched.value).toMatchObject({ status: "sold", vehicle: { category: null } });
  });

  it("lote inexistente (redireciona ao início) é `gone`; id fora do formato e erro de rede são falha", async () => {
    const { http } = fakeHttp({ [leilaoOnlineListingUrl("999")]: fixture("inicio.html") });
    expect(await leilaoOnlineSource.fetchListing(http, "999", now)).toMatchObject({ ok: false, gone: true });
    expect(await leilaoOnlineSource.fetchListing(http, "abc", now)).toMatchObject({ ok: false, gone: false });
    const down: SourceHttp = {
      get: () => Promise.resolve({ ok: false, status: 503, error: "HTTP 503" }),
      post: () => Promise.resolve({ ok: false, status: 503, error: "HTTP 503" }),
    };
    expect(await leilaoOnlineSource.fetchListing(down, "336589", now)).toMatchObject({ ok: false, gone: false });
  });

  it("página do lote fora do formato é falha comum, nunca `gone`", async () => {
    const page = fixture("lote-vendido.html").replace('class="no-margin-top m-l-15"', 'class="titulo"');
    const { http } = fakeHttp({ [leilaoOnlineListingUrl("336589")]: page });
    expect(await leilaoOnlineSource.fetchListing(http, "336589", now)).toMatchObject({ ok: false, gone: false });
  });
});
