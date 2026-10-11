import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { listingContractProblems } from "../shared/contract";
import type { FetchOutcome, SourceHttp } from "../types";
import { lanceCertoSource } from ".";
import {
  buildLanceCertoListing,
  cleanLanceCertoDescription,
  isLanceCertoVehicle,
  isLanceCertoVehicleCard,
  lanceCertoAuctionUrl,
  lanceCertoDetailsFromRaw,
  lanceCertoExternalId,
  lanceCertoHomeUrl,
  lanceCertoListingUrl,
  parseLanceCertoAuctionPage,
  parseLanceCertoHome,
  parseLanceCertoLotPage,
  placeOf,
} from "./parse";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const now = new Date("2026-10-11T15:00:00Z");

function lot(name: string, edital: string, lotId: string) {
  const page = parseLanceCertoLotPage(fixture(name), edital, lotId);
  if (page === null || page === "gone") throw new Error(`${name}: página não reconhecida`);
  return page;
}

function listing(name: string, edital: string, lotId: string, auctionState: string | null = null) {
  const value = buildLanceCertoListing({ ...lot(name, edital, lotId), auctionState }, now);
  const externalId = lanceCertoExternalId(edital, lotId);
  expect(listingContractProblems(value, { externalId, url: lanceCertoListingUrl(externalId) })).toEqual([]);
  return value;
}

describe("parseLanceCertoHome", () => {
  it("lê os editais e o total de páginas, sem os leilões ainda em loteamento", () => {
    const home = parseLanceCertoHome(fixture("home.json"));
    expect(home?.pages).toBe(2);
    expect(home?.editais).toHaveLength(15);
    expect(home?.editais).toContain("271026PRFVE");
    expect(home?.editais).toContain("TRT-REMANESCENTE");
  });

  it("resposta que não é a lista é `null`", () => {
    expect(parseLanceCertoHome("<html></html>")).toBeNull();
    expect(parseLanceCertoHome('{"Home":{}}')).toBeNull();
  });
});

describe("parseLanceCertoAuctionPage", () => {
  it("lê os cartões do leilão, a última página e a UF do texto do leilão", () => {
    const rn = parseLanceCertoAuctionPage(fixture("leilao-201026VEIC.html"), "201026VEIC");
    expect(rn?.cards).toHaveLength(32);
    expect(rn?.lastPage).toBe(2);
    expect(rn?.state).toBe("RN");
    expect(rn?.cards[0]).toEqual({
      lotId: "943954",
      category: "OUTROS",
      description: "VEÍCULO HONDA/CG 125 TITAN VERMELHA 1996/1996..",
    });
    expect(parseLanceCertoAuctionPage(fixture("leilao-301026VE.html"), "301026VE")?.state).toBe("PE");
  });

  it("fica com os veículos: máquinas, sucata de materiais e lote com vários itens saem", () => {
    const pe = parseLanceCertoAuctionPage(fixture("leilao-301026VE.html"), "301026VE");
    const vehicles = pe?.cards.filter(isLanceCertoVehicleCard).map((card) => card.lotId) ?? [];
    expect(vehicles).toHaveLength(15);
    expect(vehicles).toContain("945588");
    expect(vehicles).not.toContain("945587");
    expect(isLanceCertoVehicleCard({ lotId: "1", category: "IMÓVEIS", description: "VW/GOL 2010/2010" })).toBe(false);
  });

  it("página que não é de leilão é `null`", () => {
    expect(parseLanceCertoAuctionPage("<html></html>", "X")).toBeNull();
  });
});

describe("isLanceCertoVehicle", () => {
  it("aceita as linhas do Detran, da PRF e o texto livre das prefeituras", () => {
    expect(isLanceCertoVehicle("VEÍCULO\tHONDA/CG 125 TITAN\tVERMELHA\t1996/1996")).toBe(true);
    expect(isLanceCertoVehicle("S/REGISTRO CARRO FORD/ KA VERDE SUCATA DESTRUIR MOTOR")).toBe(true);
    expect(isLanceCertoVehicle("STRADA FIRE FLEX, ANO 2011 ,COR BRANCA, ALCOOL/GASOL, PLACA [removido]")).toBe(true);
  });

  it("recusa lote com vários veículos, máquinas e reboques", () => {
    expect(isLanceCertoVehicle("ITEM 1 - PE HONDA/CG 150 Motocicleta ITEM 2 - SR SHINERAY/XY50Q")).toBe(false);
    expect(isLanceCertoVehicle("03 SUCATAS 1 SUCATA HONDA/CG 125 FAN PRETA 2008/2008 2 SUCATA HONDA/CG 125")).toBe(
      false,
    );
    expect(isLanceCertoVehicle("TRATOR PLUS 80, MODELO U 80, ANO 2018")).toBe(false);
    expect(isLanceCertoVehicle("REBOQUE R/RADIAL RCA 2002 CINZA 2023/2023")).toBe(false);
  });
});

describe("cleanLanceCertoDescription", () => {
  it("tira as colunas de placa, Renavam, chassi e motor da linha da PRF", () => {
    expect(
      cleanLanceCertoDescription(
        "KJX3E18\tPE\tHONDA/XR 250 TORNADO\tMotocicleta\t00864215533\t9C2MD34005R017055\tMD34E-5017055\t2005\t2005\tPRETA",
      ),
    ).toBe("PE, HONDA/XR 250 TORNADO, Motocicleta, 2005, 2005, PRETA");
    expect(cleanLanceCertoDescription("FIAT/SIENA\t178F3011*6579716*\t2005\t2006")).toBe("FIAT/SIENA, 2005, 2006");
  });

  it("no texto livre, apaga os identificadores depois do rótulo", () => {
    expect(cleanLanceCertoDescription("GOL, PLACA PDU2945,CHASSI 9BWAG45UXJT147242, Nº MOTOR:CSE299624")).toBe(
      "GOL, PLACA [removido],CHASSI [removido], Nº MOTOR:[removido]",
    );
  });
});

describe("buildLanceCertoListing", () => {
  it("lote encerrado com lance é vendido pelo valor vencedor", () => {
    expect(listing("lote-encerrado.html", "300926VEIC", "938746", "RN")).toMatchObject({
      title: "JEEP/COMPASS LONG TF",
      vehicle: { brand: "JEEP", model: "COMPASS LONG TF", manufactureYear: 2021, modelYear: 2022, category: "Carros" },
      location: { state: "RN", city: null },
      status: "sold",
      sourceStatus: "Encerrado",
      currentBid: 7600000,
      bidCount: 52,
      endsAt: new Date("2026-09-30T13:00:00Z"),
      costs: { otherFees: 65000 },
    });
  });

  it("lote suspenso depois do pregão foi retirado", () => {
    expect(listing("lote-suspenso.html", "300926VEIC", "938741")).toMatchObject({ status: "withdrawn" });
  });

  it("lote aberto da PRF: UF do comitente, moto pela coluna do tipo, fotos da galeria", () => {
    const value = listing("lote-aberto-prf.html", "271026PRFVE", "946083");
    expect(value).toMatchObject({
      vehicle: { brand: "HONDA", model: "XR 250 TORNADO", modelYear: 2005, color: "PRETA", category: "Motos" },
      location: { state: "PE" },
      sellerName: "SPRF PE",
      status: "open",
      currentBid: 140000,
      minimumBid: 100000,
      bidCount: 3,
      endsAt: new Date("2026-10-27T13:01:00Z"),
    });
    expect(value.photoUrls).toHaveLength(6);
    expect(value.photoUrls[0]).toMatch(/^https:\/\/armazviplprd\.blob\.core\.windows\.net\/controle\/galeria\//);
  });

  it("sem lance, o valor atual da página não é lance", () => {
    expect(listing("lote-prefeitura-pe.html", "301026VE", "945588")).toMatchObject({
      title: "GOL TL MCV",
      vehicle: { brand: null, model: "GOL TL MCV", modelYear: 2018 },
      location: { city: "IBIMIRIM", state: "PE" },
      currentBid: null,
      minimumBid: 500000,
      bidCount: 0,
    });
  });

  it("não guarda quem deu o lance nem os identificadores do veículo", () => {
    for (const [name, edital, lotId] of [
      ["lote-aberto-prf.html", "271026PRFVE", "946083"],
      ["lote-encerrado.html", "300926VEIC", "938746"],
      ["lote-prefeitura-pe.html", "301026VE", "945588"],
    ] as const) {
      const text = JSON.stringify(listing(name, edital, lotId).raw);
      expect(text).not.toMatch(/AAA0A00|9BWAA00000A000000|00000000000|XX0000000/);
      expect(Object.keys(lot(name, edital, lotId))).not.toContain("bidder");
    }
  });
});

describe("placeOf", () => {
  it("prefeitura dá o município; outro comitente, só a UF; sem nada, a UF do leilão", () => {
    expect(placeOf("PREFEITURA MUNICIPAL TENENTE LAURENTINO CRUZ - RN", null)).toMatchObject({
      city: "TENENTE LAURENTINO CRUZ",
      state: "RN",
    });
    expect(placeOf("DETRAN PE", "RN")).toMatchObject({ city: null, state: "PE" });
    expect(placeOf("COMITENTE PARTICULAR", "RN")).toMatchObject({ city: null, state: "RN" });
    expect(placeOf(null, null)).toMatchObject({ city: null, state: null });
  });
});

describe("lanceCertoDetailsFromRaw", () => {
  it("refaz a situação do bruto guardado e recusa bruto quebrado", () => {
    const raw = buildLanceCertoListing(
      { ...lot("lote-encerrado.html", "300926VEIC", "938746"), auctionState: null },
      now,
    ).raw;
    expect(lanceCertoDetailsFromRaw(JSON.parse(JSON.stringify(raw)), now)).toMatchObject({ status: "sold" });
    expect(lanceCertoDetailsFromRaw({ lotId: 1 }, now)).toBeNull();
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

describe("lanceCertoSource", () => {
  it("descobre os veículos de todas as páginas de cada leilão", async () => {
    const only = (editais: string[]) =>
      JSON.stringify({
        Home: { LeilaoPaginas: 2 },
        Leilao: [...editais, "291026VEIC"].map((Edital) => ({
          Edital,
          Lotes: Edital === "291026VEIC" ? "Em loteamento" : "10 até agora",
        })),
      });
    const pages: Record<string, string> = {
      [lanceCertoHomeUrl(1)]: only(["201026VEIC"]),
      [lanceCertoHomeUrl(2)]: only(["301026VE"]),
      [lanceCertoAuctionUrl("201026VEIC")]: fixture("leilao-201026VEIC.html"),
      [lanceCertoAuctionUrl("201026VEIC", 2)]: fixture("leilao-201026VEIC.html"),
      [lanceCertoAuctionUrl("301026VE")]: fixture("leilao-301026VE.html"),
      [lanceCertoAuctionUrl("301026VE", 2)]: fixture("leilao-301026VE.html"),
    };
    const http = fakeHttp(pages);
    const discovery = await lanceCertoSource.discover(http, now);
    expect(discovery.errors).toEqual([]);
    expect(discovery.complete).toBe(true);
    expect(discovery.listings).toHaveLength(31 * 2 + 15 * 2);
    expect(discovery.listings[0]).toEqual({
      externalId: "201026VEIC/943954",
      url: "https://www.lancecertoleiloes.com.br/leilao/201026VEIC/lote/943954",
      lastModified: null,
    });

    // A UF do leilão já lida na descoberta serve à leitura do lote, sem nova requisição à página do leilão.
    pages[lanceCertoListingUrl("201026VEIC/943954")] = fixture("lote-detran-rn.html");
    const before = http.requested.length;
    const result = await lanceCertoSource.fetchListing(http, "201026VEIC/943954", now);
    expect(result.ok && result.value.location.state).toBe("RN");
    expect(http.requested).toHaveLength(before + 1);
  });

  it("lê o lote e a UF da página do leilão", async () => {
    const http = fakeHttp({
      [lanceCertoListingUrl("201026VEIC/943954")]: fixture("lote-detran-rn.html"),
      [lanceCertoAuctionUrl("201026VEIC")]: fixture("leilao-201026VEIC.html"),
    });
    const result = await lanceCertoSource.fetchListing(http, "201026VEIC/943954", now);
    expect(result.ok && result.value.location.state).toBe("RN");
    expect(result.ok && result.value.currentBid).toBe(200000);
  });

  it("página vazia e 404 são `gone`; fora do formato e id errado são falha comum", async () => {
    const empty = fakeHttp({ [lanceCertoListingUrl("300926VEIC/999999999")]: fixture("lote-vazio.html") });
    expect(await lanceCertoSource.fetchListing(empty, "300926VEIC/999999999", now)).toMatchObject({
      ok: false,
      gone: true,
    });
    expect(await lanceCertoSource.fetchListing(fakeHttp({}), "X/5", now)).toMatchObject({ ok: false, gone: true });
    const broken = fakeHttp({ [lanceCertoListingUrl("X/5")]: "<html></html>" });
    expect(await lanceCertoSource.fetchListing(broken, "X/5", now)).toMatchObject({ ok: false, gone: false });
    expect(await lanceCertoSource.fetchListing(broken, "5", now)).toMatchObject({ ok: false, gone: false });
  });
});
