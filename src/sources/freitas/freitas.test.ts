import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { listingContractProblems } from "../shared/contract";
import type { FetchOutcome, SourceHttp } from "../types";
import { freitasSource } from ".";
import {
  buildFreitasListing,
  freitasDetailsFromRaw,
  freitasListingUrl,
  type FreitasRaw,
  isVehicleAuction,
  parseFreitasAgenda,
  parseFreitasCards,
  parseFreitasPage,
  parseFreitasPhotos,
  parseFreitasTypes,
} from "./parse";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const openCards = parseFreitasCards(fixture("lista-aberto.html"));
const endedCards = parseFreitasCards(fixture("lista-encerrado.html"));
const now = new Date("2026-10-01T21:00:00Z");
const later = new Date("2026-10-08T21:00:00Z");

function card(cards: typeof openCards, lotNumber: number) {
  const found = cards.find((item) => item.lotNumber === lotNumber);
  if (!found) throw new Error(`lote ${lotNumber} fora da fixture`);
  return found;
}

function raw(overrides: Partial<FreitasRaw> & Pick<FreitasRaw, "card">): FreitasRaw {
  return { auctionId: "8095", damage: null, typeName: "Veículos de Passeio", yardId: 3, page: null, ...overrides };
}

describe("parseFreitasAgenda", () => {
  it("lista os leilões da agenda e reconhece os de veículos (pátios)", () => {
    const auctions = parseFreitasAgenda(fixture("agenda.html"));
    expect(auctions.length).toBeGreaterThan(20);
    expect(auctions.filter(isVehicleAuction).map((auction) => auction.auctionId)).toEqual([
      "8082",
      "8094",
      "8095",
      "8079",
      "8078",
    ]);
    expect(auctions.find((auction) => auction.auctionId === "8095")).toEqual({
      auctionId: "8095",
      local: "PÁTIO STA. BÁRBARA",
      title: "VEÍCULOS",
    });
  });
});

describe("parseFreitasCards", () => {
  it("lê número, data, descrição, lance, origem, situação e foto de cada cartão", () => {
    expect(openCards).toHaveLength(3);
    expect(card(openCards, 1)).toEqual({
      lotNumber: 1,
      lotLabel: "001",
      date: "07/10/2026",
      time: "10:00",
      description: "I/BYD SONG PLUS GS DM, 23/24, PLACA: S__-___3, GAS/ELETR, CINZA",
      valueText: "R$ 92.000,00",
      valueLabel: "Maior lance",
      origin: "FINANCEIRA",
      statusText: "ABERTO PARA LANCES",
      photo: "https://cdn3.freitasleiloeiro.com.br/LEILOES/8095/FOTOS/001/LT001_01.JPG",
    });
  });

  it("depois do leilão o cartão continua na lista com o desfecho", () => {
    expect(endedCards.map((item) => [item.lotNumber, item.statusText, item.valueLabel])).toEqual([
      [1, "VENDIDO", "Maior lance"],
      [4, "CONDICIONAL", "Maior lance"],
      [11, "RETIRADO", "Maior lance"],
      [17, "SEM LICITANTES", "Lance Inicial"],
      [25, "BAIXA OFERTA", "Maior lance"],
    ]);
  });

  it("página sem lotes ('Nenhum lote localizado') não tem cartões", () => {
    expect(parseFreitasCards('<div class="alert">Nenhum lote localizado nesse leil&#xE3;o!</div>')).toEqual([]);
  });
});

describe("parseFreitasPage", () => {
  it("lê título, destaques, observação, comissão, despesas, lance inicial, abertura e endereço de retirada", () => {
    expect(parseFreitasPage(fixture("lote-aberto.html"))).toMatchObject({
      title: "I/BYD DOLPHIN MINI GS EV - 2024/2025",
      description: "I/BYD DOLPHIN MINI GS EV, 24/25, PLACA: E__-___2, ELETR/FONTE EXT, PRETA",
      tags: ["IPVA 2026 PAGO", "CRLV DISPONÍVEL", "AR COND.", "DIR. HIDR."],
      notes: expect.stringMatching(/^SEM ESTEPE \/ NÃO POSSUI CABO CARREGADOR/),
      commissionPercent: "5",
      operationalFee: "2.350,00",
      minimumBid: "54.000,00",
      opensAt: "24/09/2026 08:38",
      yardAddress: "AV. DOS ESTADOS, 584 - PORTÃO 2 UTINGA - SANTO ANDRE/SP",
    });
  });

  it("a página de erro do site (lote já vendido) não é página de lote", () => {
    expect(parseFreitasPage(fixture("erro.html"))).toBeNull();
  });
});

describe("parseFreitasPhotos e parseFreitasTypes", () => {
  it("fotos do lote, sem repetir, todas na origem liberada", () => {
    const photos = parseFreitasPhotos(fixture("fotos.html"));
    expect(photos).toHaveLength(19);
    expect(photos[0]).toBe("https://cdn3.freitasleiloeiro.com.br/LEILOES/8082/FOTOS/002/LT002_01.JPG");
  });

  it("tipos de lote do leilão", () => {
    expect(parseFreitasTypes(fixture("tipos.json"))).toEqual([
      { id: 1, name: "Veículos de Passeio" },
      { id: 3, name: "Motos" },
      { id: 178, name: "Desconto Desp. OPE" },
      { id: 7, name: "Veículos Pesados" },
    ]);
    expect(parseFreitasTypes("<html>")).toEqual([]);
  });
});

describe("buildFreitasListing — lote aberto com a página (Santa Bárbara, lote 1 do leilão 8095)", () => {
  const page = parseFreitasPage(fixture("lote-santa-barbara.html"));
  const listing = buildFreitasListing(
    raw({ card: card(openCards, 1), page }),
    ["https://cdn3.freitasleiloeiro.com.br/x.JPG"],
    now,
  );

  it("cumpre o contrato comum dos adaptadores", () => {
    expect(listingContractProblems(listing, { externalId: "8095-1", url: freitasListingUrl("8095-1") })).toEqual([]);
    expect(listing.url).toBe("https://www.freitasleiloeiro.com.br/Leiloes/LoteDetalhes?leilaoId=8095&loteNumero=1");
  });

  it("marca e modelo sem o 'I/' de importado, anos de 2 dígitos, combustível, cor e categoria pelo tipo", () => {
    expect(listing).toMatchObject({ lotNumber: "001", title: "I/BYD SONG PLUS GS DM - 2023/2024" });
    expect(listing.vehicle).toMatchObject({
      brand: "BYD",
      model: "SONG PLUS GS DM",
      modelYear: 2024,
      manufactureYear: 2023,
      fuel: "GAS/ELETR",
      color: "CINZA",
      category: "Carros",
      recoveryType: "FINANCEIRA",
      mileageKm: null,
    });
  });

  it("lance, lance inicial, comissão e despesas; data do leilão em horário de Brasília", () => {
    expect(listing).toMatchObject({
      status: "open",
      sourceStatus: "ABERTO PARA LANCES",
      currentBid: 9_200_000,
      minimumBid: 8_100_000,
      bidCount: null,
      marketValue: null,
      endsAt: new Date("2026-10-07T13:00:00Z"),
      startsAt: new Date("2026-09-30T18:04:00Z"),
      auction: { externalId: "8095", name: "Leilão de 07/10/2026", startsAt: new Date("2026-10-07T13:00:00Z") },
    });
    expect(listing.costs).toMatchObject({ commissionRate: 500, otherFees: 235_000 });
  });

  it("local pelo endereço de retirada, com 'D OESTE' escrito como no IBGE", () => {
    expect(listing.location).toEqual({
      yardName: "Pátio Santa Bárbara",
      city: "SANTA BARBARA D'OESTE",
      state: "SP",
      address: "AV. JUSCELINO K. DE OLIVEIRA, 1350/1360 MARGINAL DA SP304",
    });
  });

  it("descrição com destaques e observação; sem chave nem condição declarada", () => {
    expect(listing.description).toMatch(/^I\/BYD SONG PLUS GS DM, 23\/24.*IPVA 2026 PAGO \/ CRLV DISPONÍVEL/);
    expect(listing.condition).toEqual({ damageLevel: null, flags: [], inspection: null, inspectionNotes: null });
  });
});

describe("buildFreitasListing — lotes encerrados, só com o cartão (a página dá erro depois da venda)", () => {
  const ended = (lotNumber: number, overrides: Partial<FreitasRaw> = {}) =>
    buildFreitasListing(
      raw({ auctionId: "8066", card: card(endedCards, lotNumber), yardId: 1, ...overrides }),
      [],
      later,
    );

  it("desfechos: vendido, condicional, retirado, sem licitantes; baixa oferta fica desconhecida", () => {
    expect([1, 4, 11, 17, 25].map((lot) => ended(lot).status)).toEqual([
      "sold",
      "conditional",
      "withdrawn",
      "unsold",
      "unknown",
    ]);
  });

  it("vendido: o maior lance é o lance final; sem licitantes: o valor é o lance inicial, sem lance", () => {
    expect(ended(1)).toMatchObject({ currentBid: 8_500_000, minimumBid: null, bidCount: null });
    expect(ended(17)).toMatchObject({ currentBid: null, minimumBid: 1_500_000, bidCount: 0 });
  });

  it("sem a página: título pelo cartão, local pelo pátio do filtro, foto do cartão e monta do filtro", () => {
    const listing = ended(1, { damage: "medium" });
    expect(listingContractProblems(listing, { externalId: "8066-1", url: freitasListingUrl("8066-1") })).toEqual([]);
    expect(listing).toMatchObject({ title: "HYUNDAI CRETA1TA PLTINUM 2022", startsAt: null });
    expect(listing.location).toEqual({ yardName: "Pátio Utinga", city: "Santo André", state: "SP", address: null });
    expect(listing.photoUrls).toEqual(["https://cdn3.freitasleiloeiro.com.br/LEILOES/8066/FOTOS/001/LT001_01.JPG"]);
    expect(listing.condition.damageLevel).toBe("medium");
  });

  it("pátio desconhecido e sem página: local desconhecido (nunca adivinhado)", () => {
    expect(ended(1, { yardId: null }).location).toEqual({ yardName: null, city: null, state: null, address: null });
  });

  it("tipo fora do vocabulário comum ('Desconto Desp. OPE') fica sem categoria", () => {
    expect(ended(1, { typeName: "Desconto Desp. OPE" }).vehicle.category).toBeNull();
  });
});

describe("freitasDetailsFromRaw", () => {
  it("rederiva descrição, condição e situação do dado guardado", () => {
    const listing = buildFreitasListing(raw({ card: card(endedCards, 25), damage: "salvage" }), [], later);
    expect(freitasDetailsFromRaw(JSON.parse(JSON.stringify(listing.raw)), later)).toEqual({
      description: "I/VW SPACEFOX SPORTLINE, 08/09, PLACA: E__-___3, GASOL/ALC, PRETA",
      condition: { damageLevel: "salvage", flags: [], inspection: null, inspectionNotes: null },
      status: "unknown",
      sourceStatus: "BAIXA OFERTA",
    });
    expect(freitasDetailsFromRaw({ outra: "coisa" }, now)).toBeNull();
  });
});

/**
 * Acesso falso: responde pela rota e pelos parâmetros, como o site. `lists` diz quais cartões cada consulta da lista
 * devolve (chave `leilão|filtro=valor`; `leilão|all` sem filtro).
 */
function fakeHttp(lists: Record<string, string>, pages: Record<string, FetchOutcome> = {}) {
  const calls: string[] = [];
  const http: SourceHttp = {
    get: (url) => {
      calls.push(url);
      const { pathname, searchParams: query } = new URL(url);
      if (pathname === "/Leiloes/ListarLeiloes") return ok(fixture("agenda.html"));
      if (pathname === "/Leiloes/PesquisarLotesTipos") return ok(fixture("tipos.json"));
      if (pathname === "/Leiloes/ListarFotosLote") return ok(fixture("fotos.html"));
      if (pathname === "/Leiloes/ListarLotes") {
        const auction = query.get("LeilaoId") ?? "";
        const filter =
          (query.get("Condicao") && `condicao=${query.get("Condicao")}`) ||
          (query.get("PatioId") !== "0" && `patio=${query.get("PatioId")}`) ||
          (query.get("TipoLoteId") !== "0" && `tipo=${query.get("TipoLoteId")}`) ||
          "all";
        const page = query.get("PageNumber") === "1" ? (lists[`${auction}|${filter}`] ?? "") : "";
        return ok(page || "Nenhum lote localizado nesse leilão!");
      }
      return Promise.resolve(pages[url] ?? { ok: false, status: 500, error: "HTTP 500" });
    },
    post: () => Promise.resolve({ ok: false, status: 405, error: "HTTP 405" }),
  };
  return { http, calls };
}

const ok = (text: string): Promise<FetchOutcome> => Promise.resolve({ ok: true, text });

describe("freitasSource", () => {
  it("descoberta: agenda + lista de cada leilão de veículos", async () => {
    const { http } = fakeHttp({ "8095|all": fixture("lista-aberto.html") });
    const discovery = await freitasSource.discover(http, now);
    expect(discovery.complete).toBe(true);
    expect(discovery.listings.map((item) => item.externalId)).toEqual(["8095-1", "8095-2", "8095-3"]);
  });

  it("agenda fora do ar: descoberta incompleta", async () => {
    const http: SourceHttp = {
      get: () => Promise.resolve({ ok: false, status: 503, error: "HTTP 503" }),
      post: () => Promise.resolve({ ok: false, status: 503, error: "HTTP 503" }),
    };
    expect(await freitasSource.discover(http, now)).toMatchObject({ complete: false, listings: [] });
  });

  it("lote aberto: cartão, filtros (monta, pátio, tipo), página e fotos; a lista do leilão é lida uma vez", async () => {
    const list = fixture("lista-aberto.html");
    const { http, calls } = fakeHttp(
      { "8095|all": list, "8095|condicao=pequena monta": list, "8095|patio=3": list, "8095|tipo=1": list },
      { [freitasListingUrl("8095-1")]: { ok: true, text: fixture("lote-santa-barbara.html") } },
    );
    const first = await freitasSource.fetchListing(http, "8095-1", now);
    expect(first.ok && first.value).toMatchObject({
      vehicle: { category: "Carros" },
      condition: { damageLevel: "small" },
      location: { city: "SANTA BARBARA D'OESTE" },
      costs: { commissionRate: 500 },
    });
    expect(first.ok && first.value.photoUrls).toHaveLength(19);

    const listCalls = () => calls.filter((url) => url.includes("/ListarLotes")).length;
    const before = listCalls();
    await freitasSource.fetchListing(http, "8095-2", now);
    expect(listCalls()).toBe(before);
  });

  it("lote encerrado: não pede a página do lote (o site responde erro 500 depois da venda)", async () => {
    const { http, calls } = fakeHttp({
      "8066|all": fixture("lista-encerrado.html"),
      "8066|patio=1": fixture("lista-encerrado.html"),
    });
    const fetched = await freitasSource.fetchListing(http, "8066-1", later);
    expect(fetched.ok && fetched.value).toMatchObject({
      status: "sold",
      currentBid: 8_500_000,
      location: { city: "Santo André" },
    });
    expect(calls.some((url) => url.includes("/LoteDetalhes"))).toBe(false);
  });

  it("lote fora da lista do leilão é `gone`; id fora do formato é falha", async () => {
    const { http } = fakeHttp({ "8066|all": fixture("lista-encerrado.html") });
    expect(await freitasSource.fetchListing(http, "8066-999", later)).toMatchObject({ ok: false, gone: true });
    expect(await freitasSource.fetchListing(http, "abc", later)).toMatchObject({ ok: false, gone: false });
  });

  it("página de lote aberto com erro é falha (tenta de novo depois), não `gone`", async () => {
    const { http } = fakeHttp({ "8095|all": fixture("lista-aberto.html") });
    expect(await freitasSource.fetchListing(http, "8095-1", now)).toMatchObject({ ok: false, gone: false });
  });
});
