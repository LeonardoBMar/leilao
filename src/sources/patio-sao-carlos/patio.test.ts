import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { listingContractProblems } from "../shared/contract";
import type { FetchOutcome, SourceHttp } from "../types";
import { patioSaoCarlosSource } from ".";
import {
  isPatioPageGone,
  parsePatioEditalAddress,
  parsePatioListing,
  parsePatioLive,
  parsePatioLotList,
  patioDetailsFromRaw,
  patioEditalUrl,
  patioListingUrl,
} from "./parse";
import type { PatioLiveLot } from "./schema";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const openPage = fixture("lote-aberto.html");
const endedPage = fixture("lote-encerrado.html");
const motoPage = fixture("lote-moto.html");
const gonePage = fixture("lote-fora-do-ar.html");
const liveJson = fixture("situacao.json");
const yardAddress = parsePatioEditalAddress(fixture("edital.html"));
const now = new Date("2026-09-30T21:00:00Z");

function liveLot(id: string): PatioLiveLot {
  const parsed = parsePatioLive(liveJson);
  const lot = parsed.ok ? parsed.value.get(id) : undefined;
  if (!lot) throw new Error(`lote ${id} fora da fixture`);
  return lot;
}

function parseOk(html: string, id: string) {
  const result = parsePatioListing(html, liveLot(id), yardAddress, now);
  if (!result.ok) throw new Error(`parse falhou: ${result.error}`);
  return result.value;
}

describe("parsePatioLotList", () => {
  it("lê os lotes da lista com a URL canônica e a última página", () => {
    const { listings, lastPage } = parsePatioLotList(fixture("lista-veiculos-pag0.html"));
    expect(listings).toHaveLength(40);
    expect(listings[0]).toEqual({ externalId: "1005", url: patioListingUrl("1005"), lastModified: null });
    expect(lastPage).toBe(5);
  });

  it("na última página não há link para a última página", () => {
    const { listings, lastPage } = parsePatioLotList(fixture("lista-veiculos-ultima.html"));
    expect(listings.length).toBeGreaterThan(0);
    expect(lastPage).toBeNull();
  });
});

describe("parsePatioLive", () => {
  it("lê a situação de vários lotes de uma vez", () => {
    const parsed = parsePatioLive(liveJson);
    expect(parsed.ok && [...parsed.value.keys()].sort()).toEqual(["1225", "1406", "1559", "1701", "991"]);
  });

  it("sem nenhum lote o site devolve lista vazia; resposta que não é JSON é dado inválido", () => {
    expect(parsePatioLive('{"item":[]}')).toEqual({ ok: true, value: new Map() });
    expect(parsePatioLive("<html>")).toEqual({ ok: false, error: "invalid_data" });
  });
});

describe("parsePatioListing — lote aberto (Yaris, lote 20 do leilão 39)", () => {
  const listing = parseOk(openPage, "991");

  it("cumpre o contrato comum dos adaptadores", () => {
    expect(listingContractProblems(listing, { externalId: "991", url: patioListingUrl("991") })).toEqual([]);
  });

  it("lê a ficha do veículo, com a FIPE como valor de mercado e a categoria no vocabulário comum", () => {
    expect(listing).toMatchObject({ externalId: "991", lotNumber: "20", title: "YARIS SEDA XLS CVT 1.5 2020" });
    expect(listing.vehicle).toMatchObject({
      brand: "TOYOTA",
      model: "YARIS SEDA",
      fipeName: "YARIS SEDA XLS CVT 1.5 16V DUAL VVT-I",
      modelYear: 2020,
      category: "Carros",
      fuel: "FLEXIVEL ALCOOL/GASOLINA",
      recoveryType: "RECUPERADO FINANCIAMENTO",
      hasKey: true,
    });
    expect(listing.marketValue).toBe(8_291_800);
    expect(listing.costs.commissionRate).toBe(500);
  });

  it("descrição em texto puro: linhas da ficha que não são campo e o texto do leiloeiro", () => {
    expect(listing.description).toMatch(/^Condição de Func.:Motor da partida /);
    expect(listing.description).toMatch(/IPVA 2026 PAGO/);
    expect(listing.description).not.toMatch(/[<>]/);
  });

  it("lance, situação e datas vêm da consulta interna, no horário de Brasília", () => {
    expect(listing).toMatchObject({ status: "open", sourceStatus: "1", currentBid: 3_430_000, bidCount: 23 });
    expect(listing.minimumBid).toBe(2_990_000);
    expect(listing.startsAt).toEqual(new Date("2026-09-29T11:00:00Z"));
    expect(listing.endsAt).toEqual(new Date("2026-10-02T13:18:00Z"));
    expect(listing.auction).toEqual({ externalId: "39", name: "Leilão de 02/10/2026", startsAt: null });
  });

  it("local vem do edital (pátio de visitação), não do local de origem da consulta interna", () => {
    expect(listing.location).toEqual({
      yardName: "Pátio Estadual São Carlos",
      city: "São Carlos",
      state: "SP",
      address: "Estr. Mun. Washington José Pêra, 2840, ÁGUA FRIA",
    });
  });

  it("sem edital: local desconhecido, nunca adivinhado", () => {
    const result = parsePatioListing(openPage, liveLot("991"), null, now);
    expect(result.ok && result.value.location).toEqual({ yardName: null, city: null, state: null, address: null });
  });

  it("fotos da galeria do lote, sem miniaturas nem fotos de outros lotes", () => {
    expect(listing.photoUrls.length).toBeGreaterThan(1);
    expect(listing.photoUrls[0]).toBe("https://patioestadualsc.org/web/fotos/principal_import_68bb8030d6d7f.jpg");
    expect(new Set(listing.photoUrls).size).toBe(listing.photoUrls.length);
  });

  it("guarda o dado bruto sem quem deu lance, e dele rederiva descrição, condição e situação", () => {
    expect(JSON.stringify(listing.raw)).not.toMatch(/lances_cadastro|cronometro_atual|removido/);
    const { live } = z.object({ live: z.record(z.string(), z.unknown()) }).parse(listing.raw);
    expect(Object.keys(live).sort()).toEqual([
      "box_id",
      "categorias",
      "count_lances",
      "cronometro",
      "lance",
      "leiloes",
      "local",
      "nome",
      "situacao",
    ]);
    expect(z.object({ yardAddress: z.string() }).parse(listing.raw).yardAddress).toMatch(/São Carlos, SÃO PAULO/);
    expect(patioDetailsFromRaw(listing.raw, now)).toEqual({
      description: listing.description,
      condition: listing.condition,
      status: listing.status,
      sourceStatus: listing.sourceStatus,
    });
    expect(patioDetailsFromRaw({ outro: "formato" }, now)).toBeNull();
  });
});

describe("parsePatioListing — lote encerrado (BYD, 30/09/2026)", () => {
  const listing = parseOk(endedPage, "1701");

  it("arrematado: vendido, com lance final e número de lances", () => {
    expect(listing).toMatchObject({ status: "sold", sourceStatus: "2", currentBid: 6_810_000, bidCount: 32 });
  });

  it("ficha em outro formato (rótulos em negrito, km, ano de fabricação, SUV)", () => {
    expect(listing.vehicle).toMatchObject({
      brand: "BYD",
      model: "Song Plus",
      modelYear: 2023,
      manufactureYear: 2022,
      mileageKm: 43_729,
      category: "Carros",
      recoveryType: "Recuperado de Financiamento",
    });
    expect(listing.marketValue).toBe(16_093_500);
    expect(listing.description).toMatch(/chave reserva/);
  });
});

describe("parsePatioListing — moto (BMW F 850)", () => {
  const listing = parseOk(motoPage, "1406");

  it("FIPE sem dois-pontos, km em branco e categoria pelo grupo da consulta", () => {
    expect(listing.vehicle).toMatchObject({ brand: "BMW", model: "F 850", mileageKm: null, category: "Motos" });
    expect(listing.marketValue).toBe(6_784_700);
  });
});

describe("situações da consulta interna", () => {
  it("não arrematado sem nenhum lance: sem lance atual, com o lance inicial", () => {
    const listing = parseOk(openPage, "1559");
    expect(listing).toMatchObject({ status: "unsold", currentBid: null, bidCount: 0, minimumBid: 1_950_000 });
  });

  it("condicional e situação desconhecida (antes e depois do fim)", () => {
    expect(parseOk(openPage, "1225").status).toBe("conditional");
    const directSale = { ...liveLot("991"), situacao: 20 };
    const before = parsePatioListing(openPage, directSale, yardAddress, now);
    const after = parsePatioListing(openPage, directSale, yardAddress, new Date("2026-10-03T00:00:00Z"));
    expect(before.ok && before.value.status).toBe("open");
    expect(after.ok && after.value.status).toBe("unknown");
  });
});

describe("isPatioPageGone", () => {
  it("o site responde 200 com 'Nenhum Lote Encontrado' quando tira a página do ar", () => {
    expect(isPatioPageGone(gonePage)).toBe(true);
    expect(isPatioPageGone(openPage)).toBe(false);
  });
});

/** Acesso falso: GET pela URL, POST sempre com a fixture de situação. */
function fakeHttp(pages: Record<string, FetchOutcome>) {
  const calls: string[] = [];
  const http: SourceHttp = {
    get: (url) => {
      calls.push(`GET ${url}`);
      return Promise.resolve(pages[url] ?? { ok: false, status: 404, error: "HTTP 404" });
    },
    post: (url, form) => {
      calls.push(`POST ${url} ${form.lotes}`);
      return Promise.resolve({ ok: true, text: liveJson });
    },
  };
  return { http, calls };
}

describe("patioSaoCarlosSource", () => {
  it("descoberta: listas por categoria e só lotes abertos ou encerrados há até 3 dias", async () => {
    const list = ["991", "1701", "1559", "1225", "1406"].map((id) => `<a href="/lote/x/${id}/">`).join("");
    const html = { ok: true as const, text: list };
    const { http, calls } = fakeHttp({
      "https://patioestadualsc.org/lotes/?cate%5B0%5D=1&pag=0": html,
      "https://patioestadualsc.org/lotes/?cate%5B0%5D=2&pag=0": html,
    });
    const discovery = await patioSaoCarlosSource.discover(http, now);
    expect(discovery.complete).toBe(true);
    expect(discovery.listings.map((item) => item.externalId).sort()).toEqual(["1406", "1701", "991"]);
    // Uma consulta de situação para todos os lotes, não uma por lote.
    expect(calls.filter((call) => call.startsWith("POST"))).toHaveLength(1);
  });

  it("lista maior que o teto de páginas: descoberta incompleta, para não concluir que lotes saíram da lista", async () => {
    const page = '<a href="/lote/x/991/"><a href="/lotes/?cate%5B0%5D=1&amp;pag=99" aria-label="Última página">';
    const http: SourceHttp = {
      get: (url) => Promise.resolve({ ok: true, text: url.endsWith("pag=0") ? page : '<a href="/lote/x/991/">' }),
      post: () => Promise.resolve({ ok: true, text: liveJson }),
    };
    const discovery = await patioSaoCarlosSource.discover(http, now);
    expect(discovery.complete).toBe(false);
    expect(discovery.errors[0]?.error).toMatch(/100 páginas/);
  });

  it("descoberta sem a consulta de situação: incompleta e sem anúncios (não tenta páginas que podem estar fora do ar)", async () => {
    const http: SourceHttp = {
      get: () => Promise.resolve({ ok: true, text: '<a href="/lote/x/991/">' }),
      post: () => Promise.resolve({ ok: false, status: 503, error: "HTTP 503" }),
    };
    const discovery = await patioSaoCarlosSource.discover(http, now);
    expect(discovery).toMatchObject({ complete: false, listings: [] });
  });

  it("lê um lote juntando a página, a consulta interna e o edital", async () => {
    const { http, calls } = fakeHttp({
      [patioListingUrl("991")]: { ok: true, text: openPage },
      [patioEditalUrl("991")]: { ok: true, text: fixture("edital.html") },
    });
    const fetched = await patioSaoCarlosSource.fetchListing(http, "991", now);
    expect(fetched.ok && fetched.value.location.city).toBe("São Carlos");
    expect(calls).toContain(`GET ${patioEditalUrl("991")}`);
  });

  it("edital fora do ar não impede a leitura: só o local fica desconhecido", async () => {
    const { http } = fakeHttp({ [patioListingUrl("991")]: { ok: true, text: openPage } });
    const fetched = await patioSaoCarlosSource.fetchListing(http, "991", now);
    expect(fetched.ok && fetched.value.location.state).toBeNull();
  });

  it("página fora do ar ('Nenhum Lote Encontrado', 404 ou 410) é `gone`", async () => {
    const { http } = fakeHttp({ [patioListingUrl("1225")]: { ok: true, text: gonePage } });
    expect(await patioSaoCarlosSource.fetchListing(http, "1225", now)).toMatchObject({ ok: false, gone: true });
    expect(await patioSaoCarlosSource.fetchListing(http, "777", now)).toMatchObject({ ok: false, gone: true });
    const removed: SourceHttp = { ...http, get: () => Promise.resolve({ ok: false, status: 410, error: "HTTP 410" }) };
    expect(await patioSaoCarlosSource.fetchListing(removed, "778", now)).toMatchObject({ ok: false, gone: true });
  });
});
