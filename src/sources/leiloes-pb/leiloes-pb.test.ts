import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { listingContractProblems } from "../shared/contract";
import type { FetchOutcome, SourceHttp } from "../types";
import { leiloesPbSource } from ".";
import {
  buildLeiloesPbListing,
  LEILOES_PB_HOME_URL,
  leiloesPbAuctionUrl,
  leiloesPbDetailsFromRaw,
  leiloesPbListingUrl,
  parseLeiloesPbAuctionPage,
  parseLeiloesPbHome,
  parseLeiloesPbLotPage,
  parseLeiloesPbTitle,
} from "./parse";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const now = new Date("2026-10-11T03:00:00Z");

function lot(name: string) {
  const raw = parseLeiloesPbLotPage(fixture(name));
  if (!raw) throw new Error(`${name}: página não reconhecida`);
  return raw;
}

function listing(name: string) {
  const raw = lot(name);
  const value = buildLeiloesPbListing(raw, now);
  expect(listingContractProblems(value, { externalId: raw.lotId, url: leiloesPbListingUrl(raw.lotId) })).toEqual([]);
  return value;
}

describe("parseLeiloesPbHome", () => {
  it("lê os eventos da página inicial, sem repetir", () => {
    expect(parseLeiloesPbHome(fixture("inicio.html"))?.sort()).toEqual([
      "2073",
      "2078",
      "2085",
      "2095",
      "2099",
      "2100",
    ]);
  });

  it("sem a seção de eventos é `null` (o site mudou)", () => {
    expect(parseLeiloesPbHome("<html><body>manutenção</body></html>")).toBeNull();
  });
});

describe("parseLeiloesPbAuctionPage", () => {
  it("lê os lotes de veículo da página e a última página", () => {
    const first = parseLeiloesPbAuctionPage(fixture("evento-2100-p1.html"), "2100");
    expect(first?.lotIds).toHaveLength(48);
    expect(first?.lotIds[0]).toBe("44200");
    expect(first?.lastPage).toBe(2);
    expect(parseLeiloesPbAuctionPage(fixture("evento-2100-p2.html"), "2100")?.lotIds).toHaveLength(17);
  });

  it("deixa de fora imóveis, bens diversos e máquinas", () => {
    expect(parseLeiloesPbAuctionPage(fixture("evento-2085.html"), "2085")?.lotIds).toEqual([]);
  });

  it("página de outro evento é `null`", () => {
    expect(parseLeiloesPbAuctionPage(fixture("evento-2100-p1.html"), "2099")).toBeNull();
  });
});

describe("parseLeiloesPbTitle", () => {
  it("separa marca, modelo, anos e combustível", () => {
    expect(parseLeiloesPbTitle("FIAT  /  STRADA WORKING 1.4 MPI FIRE 8V CS FLEX 2014/2015", now)).toEqual({
      name: "FIAT / STRADA WORKING 1.4 MPI FIRE 8V CS FLEX",
      brand: "FIAT",
      model: "STRADA WORKING 1.4 MPI FIRE 8V CS FLEX",
      manufactureYear: 2014,
      modelYear: 2015,
      fuel: "FLEX",
      salvage: false,
    });
  });

  it("reconhece sucata, ano repetido e diesel abreviado", () => {
    const palio = parseLeiloesPbTitle("(SUCATA) FIAT / PALIO ATTRACTIVE 2012/2012 2012/2012", now);
    expect(palio).toMatchObject({ name: "FIAT / PALIO ATTRACTIVE", modelYear: 2012, salvage: true, fuel: null });
    expect(parseLeiloesPbTitle("LAND ROVER / RANGE ROVER VOGUE SE 4.4 SDV8 DIES. AUT 2014/2015", now).fuel).toBe(
      "DIESEL",
    );
  });

  it("título sem ano fica sem ano", () => {
    expect(parseLeiloesPbTitle("VOLKSWAGEN / SAVEIRO TRENDLINE 1.6 TOTAL FLEX 8V", now)).toMatchObject({
      manufactureYear: null,
      modelYear: null,
    });
  });
});

describe("buildLeiloesPbListing", () => {
  it("lote aberto: lance inicial, valor de mercado da fonte, pátio de Bayeux e condição", () => {
    const value = listing("lote-aberto.html");
    expect(value).toMatchObject({
      externalId: "44200",
      lotNumber: "1",
      title: "RENAULT / KWID INTENSE 1.0 12V 5P MEC. FLEX",
      vehicle: { brand: "RENAULT", modelYear: 2023, color: "PRETO", category: "Carros", hasKey: true },
      auction: { externalId: "2100", name: "LEILÃO HDI, YELUM, ALIRO E INDIANA SEGUROS" },
      sellerName: "HDI",
      status: "open",
      sourceStatus: "Aberto para Lances",
      currentBid: null,
      bidCount: 0,
      minimumBid: 1_900_000,
      marketValue: 5_245_200,
      location: { city: "BAYEUX", state: "PB" },
      condition: { damageLevel: "medium" },
      costs: { commissionRate: 500, otherFees: 193_300 },
    });
    // 09/10/2026 14:00 em Fortaleza (UTC−3).
    expect(value.auction.startsAt?.toISOString()).toBe("2026-10-09T17:00:00.000Z");
    expect(value.photoUrls).toHaveLength(10);
  });

  it("vendido: o arremate é o preço final, com a hora do fechamento", () => {
    const value = listing("lote-vendido.html");
    expect(value).toMatchObject({ status: "sold", sourceStatus: "Vendido", currentBid: 2_480_000, bidCount: 1 });
    expect(value.endsAt?.toISOString()).toBe("2026-10-02T17:27:59.000Z");
    expect(value.location).toMatchObject({ city: "FEIRA DE SANTANA", state: "BA" });
  });

  it("mapeia as demais situações", () => {
    expect(listing("lote-sem-licitantes.html")).toMatchObject({ status: "unsold", currentBid: null });
    expect(listing("lote-baixa-oferta.html")).toMatchObject({ status: "conditional", currentBid: 1_920_000 });
    expect(listing("lote-homologando.html").status).toBe("conditional");
    expect(listing("lote-retirado.html").status).toBe("withdrawn");
    expect(listing("lote-cancelado.html").status).toBe("withdrawn");
  });

  it("categoria pela marca e modelo; sucata vira Sucatas", () => {
    expect(listing("lote-moto.html").vehicle.category).toBe("Motos");
    expect(listing("lote-homologando.html").vehicle.category).toBe("Utilitarios");
    const salvage = listing("lote-pesado-sucata.html");
    expect(salvage.vehicle.category).toBe("Sucatas");
    expect(salvage.condition.damageLevel).toBe("salvage");
  });

  it("sem a linha do pátio, o local fica desconhecido", () => {
    expect(listing("lote-retirado.html").location).toEqual({ yardName: null, city: null, state: null, address: null });
  });

  it("não guarda quem deu lance nem o número do sinistro", () => {
    const raw = JSON.stringify(lot("lote-vendido.html"));
    expect(raw).not.toMatch(/apelido|autor|comprador|"ip"/);
    expect(raw).not.toContain("010495351541671");
    expect(listing("lote-vendido.html").description).toContain("Sinistro: COLISÃO");
  });

  it("detailsFromRaw rederiva descrição, condição e situação", () => {
    const value = listing("lote-vendido.html");
    expect(leiloesPbDetailsFromRaw(value.raw, now)).toEqual({
      description: value.description,
      condition: value.condition,
      status: "sold",
      sourceStatus: "Vendido",
    });
    expect(leiloesPbDetailsFromRaw({ lotId: 1 }, now)).toBeNull();
  });
});

function fakeHttp(pages: Record<string, string>): SourceHttp & { requested: string[] } {
  const requested: string[] = [];
  const get = (url: string): Promise<FetchOutcome> => {
    requested.push(url);
    const text = pages[url];
    return Promise.resolve(text === undefined ? { ok: false, status: 404, error: "HTTP 404" } : { ok: true, text });
  };
  return { requested, get, post: () => Promise.resolve({ ok: false, status: null, error: "sem POST" }) };
}

describe("leiloesPbSource", () => {
  it("descobre os lotes de veículo de todos os eventos da página inicial", async () => {
    const empty = fixture("evento-2085.html");
    const http = fakeHttp({
      [LEILOES_PB_HOME_URL]: fixture("inicio.html"),
      [leiloesPbAuctionUrl("2100", 1)]: fixture("evento-2100-p1.html"),
      [leiloesPbAuctionUrl("2100", 2)]: fixture("evento-2100-p2.html"),
      ...Object.fromEntries(
        ["2073", "2078", "2085", "2095", "2099"].map((id) => [
          leiloesPbAuctionUrl(id, 1),
          empty.replaceAll("#/auditorio/2085", `#/auditorio/${id}`),
        ]),
      ),
    });
    const discovery = await leiloesPbSource.discover(http, now);
    expect(discovery.complete).toBe(true);
    expect(discovery.errors).toEqual([]);
    expect(discovery.listings).toHaveLength(65);
    expect(discovery.listings[0]).toEqual({
      externalId: "44200",
      url: leiloesPbListingUrl("44200"),
      lastModified: null,
    });
  });

  it("evento que falha deixa a descoberta incompleta", async () => {
    const http = fakeHttp({ [LEILOES_PB_HOME_URL]: fixture("inicio.html") });
    const discovery = await leiloesPbSource.discover(http, now);
    expect(discovery.complete).toBe(false);
    expect(discovery.errors).toHaveLength(6);
  });

  it("lê o lote pela URL canônica e recusa página de outro lote", async () => {
    const http = fakeHttp({ [leiloesPbListingUrl("43939")]: fixture("lote-vendido.html") });
    const result = await leiloesPbSource.fetchListing(http, "43939", now);
    expect(result.ok && result.value.status).toBe("sold");

    const other = fakeHttp({ [leiloesPbListingUrl("1")]: fixture("lote-vendido.html") });
    expect(await leiloesPbSource.fetchListing(other, "1", now)).toMatchObject({ ok: false, gone: true });
  });

  it("404 é `gone`; página fora do formato é falha comum", async () => {
    expect(await leiloesPbSource.fetchListing(fakeHttp({}), "5", now)).toMatchObject({ ok: false, gone: true });
    const broken = fakeHttp({ [leiloesPbListingUrl("5")]: "<html></html>" });
    expect(await leiloesPbSource.fetchListing(broken, "5", now)).toMatchObject({ ok: false, gone: false });
  });
});
