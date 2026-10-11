import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { listingContractProblems } from "../shared/contract";
import type { FetchOutcome, SourceHttp } from "../types";
import { leiloesFreireSource } from ".";
import {
  buildLeiloesFreireListing,
  firstLotOfAuctionPage,
  isFreireVehicle,
  LEILOES_FREIRE_AUCTIONS_URL,
  leiloesFreireAuctionUrl,
  leiloesFreireDetailsFromRaw,
  leiloesFreireListingUrl,
  parseLeiloesFreireAuctions,
  parseLeiloesFreireDescription,
  parseLeiloesFreireLotPage,
  placeOf,
} from "./parse";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const now = new Date("2026-10-11T03:00:00Z");

function lots(name: string) {
  const raws = parseLeiloesFreireLotPage(fixture(name));
  if (!raws) throw new Error(`${name}: página não reconhecida`);
  return raws;
}

function listing(name: string, lotId: string) {
  const raw = lots(name).find((lot) => lot.lotId === lotId);
  if (!raw) throw new Error(`${name}: sem o lote ${lotId}`);
  const value = buildLeiloesFreireListing(raw, now);
  expect(listingContractProblems(value, { externalId: lotId, url: leiloesFreireListingUrl(lotId) })).toEqual([]);
  return value;
}

describe("parseLeiloesFreireAuctions", () => {
  it("lê os leilões abertos, sem repetir", () => {
    expect(parseLeiloesFreireAuctions(fixture("leiloes.html"))?.sort()).toEqual(["1183", "1184", "1186", "1188"]);
  });

  it("sem leilão nenhum é `null` (o site mudou)", () => {
    expect(parseLeiloesFreireAuctions("<html><body>manutenção</body></html>")).toBeNull();
  });
});

describe("firstLotOfAuctionPage", () => {
  it("acha o primeiro lote na página do leilão", () => {
    expect(firstLotOfAuctionPage(fixture("leilao-1184.html"))).toBe("31085");
    expect(firstLotOfAuctionPage("<html></html>")).toBeNull();
  });
});

describe("parseLeiloesFreireLotPage", () => {
  it("lê todos os lotes do leilão a partir da página de um deles", () => {
    expect(lots("lote-vendido-al.html")).toHaveLength(8);
    expect(lots("lote-se-encerrado.html")).toHaveLength(17);
    expect(lots("lote-aberto-pe.html")).toHaveLength(27);
    expect(parseLeiloesFreireLotPage("<html></html>")).toBeNull();
  });

  it("fica só com os lotes de veículo", () => {
    const se = lots("lote-se-encerrado.html");
    const pe = lots("lote-aberto-pe.html");
    expect(se.filter((lot) => isFreireVehicle(lot.description))).toHaveLength(14);
    expect(pe.filter((lot) => isFreireVehicle(lot.description))).toHaveLength(20);
    const notVehicles = [...se, ...pe].filter((lot) => !isFreireVehicle(lot.description)).map((lot) => lot.lotId);
    expect(notVehicles).toContain("30971");
    expect(notVehicles).toContain("31092");
  });

  it("não guarda placa, chassi, Renavam nem dado de quem deu lance", () => {
    for (const name of ["lote-vendido-al.html", "lote-se-encerrado.html", "lote-aberto-pe.html"]) {
      for (const lot of lots(name)) {
        const text = JSON.stringify(lot);
        expect(text).not.toMatch(/arrematante|apelido|user_id|"ip"/i);
        expect(text).not.toMatch(/\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/);
        expect(text).not.toMatch(/CHASSI\s*:?\s*(?!\[removido\])[A-Z0-9]{8,}/);
      }
    }
  });
});

describe("buildLeiloesFreireListing", () => {
  it("lote vendido traz o valor da venda, a cidade do título e as fotos", () => {
    expect(listing("lote-vendido-al.html", "30935")).toMatchObject({
      title: "MICRO ÔNIBUS IVECO/CITYCLASS 70C17",
      vehicle: {
        brand: "IVECO",
        model: "CITYCLASS 70C17",
        manufactureYear: 2012,
        modelYear: 2013,
        category: "Pesados",
      },
      auction: { externalId: "1170", name: "PREFEITURA M. DA BARRA DE SANTO ANTONIO - AL" },
      location: { city: "BARRA DE SANTO ANTONIO", state: "AL" },
      status: "sold",
      sourceStatus: "Vendido",
      currentBid: 2640000,
      minimumBid: 1000000,
      endsAt: new Date("2026-09-22T13:58:31Z"),
      costs: { commissionRate: 500 },
    });
    expect(listing("lote-vendido-al.html", "30935").photoUrls[0]).toMatch(
      /^https:\/\/www\.leiloesfreire\.com\.br\/storage\/lotes\//,
    );
  });

  it("lote sem lance de leilão encerrado não foi vendido", () => {
    expect(listing("lote-se-encerrado.html", "30964")).toMatchObject({
      vehicle: { brand: "RENAULT", model: "LOGAN AUTH 1.0", category: "Carros" },
      location: { city: "LARANJEIRAS", state: "SE" },
      status: "unsold",
      currentBid: null,
      minimumBid: 1500000,
    });
  });

  it("lote de leilão futuro está aberto", () => {
    expect(listing("lote-aberto-pe.html", "31085")).toMatchObject({
      location: { city: "ALIANÇA", state: "PE" },
      status: "open",
      minimumBid: 1800000,
      endsAt: new Date("2026-10-20T13:00:00Z"),
    });
    expect(listing("lote-aberto-pe.html", "31086").vehicle.category).toBe("Utilitarios");
  });
});

describe("placeOf", () => {
  it("leilão do Detran-AL fica na cidade entre parênteses", () => {
    expect(placeOf("DETRAN/AL - EDITAL 003/2026 (MACEIÓ)", null)).toMatchObject({ city: "MACEIÓ", state: "AL" });
  });
});

describe("parseLeiloesFreireDescription", () => {
  it("ano com dois dígitos e cor junto do combustível", () => {
    expect(
      parseLeiloesFreireDescription("CAVALO MECÂNICO M.BENZ/AXOR 2544S, ANO/MOD 09/10, COR BRANCA A DIESEL", now),
    ).toMatchObject({
      brand: "MERCEDES-BENZ",
      model: "AXOR 2544S",
      manufactureYear: 2009,
      modelYear: 2010,
      color: "BRANCA",
      fuel: "DIESEL",
      category: "Pesados",
    });
  });

  it("barra da carroceria não separa marca e modelo", () => {
    expect(
      parseLeiloesFreireDescription("CAMINHÃO FORD CARGO 1719 BS/COMPACTAD, ANO/MOD 2012/2012, COR BRANCA", now),
    ).toMatchObject({ brand: "FORD", model: "CARGO 1719 BS/COMPACTAD", category: "Pesados" });
  });
});

describe("leiloesFreireDetailsFromRaw", () => {
  it("refaz os detalhes do bruto guardado e recusa bruto quebrado", () => {
    const raw = lots("lote-vendido-al.html").find((lot) => lot.lotId === "30935");
    expect(leiloesFreireDetailsFromRaw(JSON.parse(JSON.stringify(raw)), now)).toMatchObject({ status: "sold" });
    expect(leiloesFreireDetailsFromRaw({ lotId: 1 }, now)).toBeNull();
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

describe("leiloesFreireSource", () => {
  const pages = {
    [LEILOES_FREIRE_AUCTIONS_URL]: fixture("leiloes.html"),
    [leiloesFreireAuctionUrl("1184")]: fixture("leilao-1184.html"),
    [leiloesFreireListingUrl("31085")]: fixture("lote-aberto-pe.html"),
  };

  it("descobre os lotes de veículo e lê cada leilão uma vez só", async () => {
    const http = fakeHttp(pages);
    const discovery = await leiloesFreireSource.discover(http, now);
    expect(discovery.complete).toBe(false);
    expect(discovery.errors).toHaveLength(3);
    expect(discovery.listings).toHaveLength(20);
    expect(discovery.listings[0]).toEqual({
      externalId: "31085",
      url: leiloesFreireListingUrl("31085"),
      lastModified: null,
    });

    const before = http.requested.length;
    const result = await leiloesFreireSource.fetchListing(http, "31086", now);
    expect(result.ok && result.value.status).toBe("open");
    expect(http.requested).toHaveLength(before);
  });

  it("lê o lote pela página dele", async () => {
    const http = fakeHttp({ [leiloesFreireListingUrl("30935")]: fixture("lote-vendido-al.html") });
    const result = await leiloesFreireSource.fetchListing(http, "30935", now);
    expect(result.ok && result.value.currentBid).toBe(2640000);
  });

  it("404 é `gone`; página fora do formato é falha comum", async () => {
    expect(await leiloesFreireSource.fetchListing(fakeHttp({}), "5", now)).toMatchObject({ ok: false, gone: true });
    const broken = fakeHttp({ [leiloesFreireListingUrl("5")]: "<html></html>" });
    expect(await leiloesFreireSource.fetchListing(broken, "5", now)).toMatchObject({ ok: false, gone: false });
  });
});
