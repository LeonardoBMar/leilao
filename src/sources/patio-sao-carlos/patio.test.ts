import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { listingContractProblems } from "../shared/contract";
import type { FetchOutcome, SourceHttp } from "../types";
import { patioSaoCarlosSource } from ".";
import {
  parsePatioEditalAddress,
  parsePatioListing,
  parsePatioLotList,
  patioDetailsFromRaw,
  patioEditalUrl,
  patioListingUrl,
  patioListUrl,
} from "./parse";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const listPage1 = fixture("lista-veiculos-pag1.html");
const openPage = fixture("lote-aberto.html");
const endedPage = fixture("lote-encerrado.html");
const motoPage = fixture("lote-moto.html");
const yardAddress = parsePatioEditalAddress(fixture("edital.html"));
const now = new Date("2026-11-24T01:00:00Z");

function nextFlightPage(payload: Record<string, unknown>): string {
  const chunk = JSON.stringify(`1:["$","div",null,${JSON.stringify(payload)}]`);
  return `<!doctype html><html><body><script>self.__next_f.push([1,${chunk}])</script></body></html>`;
}

function parseOk(html: string, address: string | null = yardAddress, at: Date = now) {
  const result = parsePatioListing(html, address, at);
  if (!result.ok) throw new Error(`parse falhou: ${result.error}`);
  return result.value;
}

describe("parsePatioLotList", () => {
  it("lê os lotes da lista paginada no RSC Flight e calcula o total de páginas", () => {
    const parsed = parsePatioLotList(listPage1);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.items).toHaveLength(12);
    expect(parsed.value.items[0]).toMatchObject({ id: "1628", status: "OPEN" });
    expect(parsed.value.totalPages).toBe(14);
  });

  it("HTML sem initialLotes é missing_data; formato inválido é invalid_data", () => {
    expect(parsePatioLotList("<html><body>Manutenção</body></html>")).toEqual({ ok: false, error: "missing_data" });
    expect(parsePatioLotList(nextFlightPage({ initialLotes: { itens: "errado" } }))).toEqual({
      ok: false,
      error: "invalid_data",
    });
  });
});

describe("parsePatioListing — lote aberto (Grand Siena, lote 60 do leilão 52)", () => {
  const listing = parseOk(openPage);

  it("cumpre o contrato comum dos adaptadores", () => {
    expect(listingContractProblems(listing, { externalId: "1628", url: patioListingUrl("1628") })).toEqual([]);
  });

  it("lê a ficha do veículo, FIPE, comissão de 5% e taxa administrativa do leilão", () => {
    expect(listing).toMatchObject({
      externalId: "1628",
      lotNumber: "60",
      title: "FIAT GRAND SIENA 1.6 16/16",
      sellerName: "Bancos e Seguradoras",
    });
    expect(listing.vehicle).toMatchObject({
      brand: "FIAT",
      model: "GRAND SIENA",
      fipeName: "GRAND SIENA ESSENCE 1.6 16V E.TORQ",
      modelYear: 2016,
      manufactureYear: 2016,
      mileageKm: null,
      category: "Carros",
      fuel: "FLEX",
      recoveryType: "RECUPERADO DE FINANCIAMENTO",
      hasKey: true,
    });
    expect(listing.marketValue).toBe(3_998_400);
    expect(listing.costs.commissionRate).toBe(500);
    expect(listing.costs.otherFees).toBe(62_000);
  });

  it("lance, situação, datas em UTC e evento vêm do RSC Flight", () => {
    expect(listing).toMatchObject({
      status: "open",
      sourceStatus: "OPEN",
      currentBid: 1_760_000,
      minimumBid: 1_580_000,
      bidCount: 7,
    });
    expect(listing.startsAt).toEqual(new Date("2026-11-23T22:15:00Z"));
    expect(listing.endsAt).toEqual(new Date("2026-11-26T13:59:00Z"));
    expect(listing.auction).toEqual({
      externalId: "52",
      name: "Leilão de Veículos",
      startsAt: new Date("2026-11-23T22:15:00Z"),
    });
  });

  it("local vem do edital (pátio de visitação), não do cidade/uf do initialLote", () => {
    expect(listing.location).toEqual({
      yardName: "Pátio Estadual São Carlos",
      city: "São Carlos",
      state: "SP",
      address: "Estr. Mun. Washington José Pêra, 2840, ÁGUA FRIA",
    });
    expect(parseOk(openPage, null).location).toEqual({ yardName: null, city: null, state: null, address: null });
  });

  it("fotos da galeria sem duplicadas nem miniaturas, todas na origem autorizada", () => {
    expect(listing.photoUrls.length).toBeGreaterThan(1);
    expect(listing.photoUrls[0]).toBe("https://patioestadualsc.org/web/fotos/principal_import_6a2b74533ce55.jpg");
    expect(new Set(listing.photoUrls).size).toBe(listing.photoUrls.length);
  });

  it("guarda raw sanitizado (sem metadados de placa/chassi/Renavam) e rederiva detalhes", () => {
    const rawStr = JSON.stringify(listing.raw);
    expect(rawStr).not.toMatch(/metadados|visualizacoes|retirada|formaPagamento/);
    expect(z.object({ yardAddress: z.string() }).parse(listing.raw).yardAddress).toMatch(/São Carlos, SÃO PAULO/);
    expect(patioDetailsFromRaw(listing.raw, now)).toEqual({
      description: listing.description,
      condition: listing.condition,
      status: listing.status,
      sourceStatus: listing.sourceStatus,
    });
    expect(patioDetailsFromRaw({ outro: "formato" }, now)).toBeNull();
  });

  it("apaga placa, chassi e Renavam da descrição, notas, metadados e raw", () => {
    const page = nextFlightPage({
      initialLote: {
        id: "9999",
        titulo: "CARRO TESTE 2020",
        auctionId: "52",
        numero: 1,
        categoria: "Veículos",
        status: "OPEN",
        lanceAtualCentavos: null,
        lanceInicialCentavos: 1_000_000,
        valorFipeCentavos: 2_500_000,
        qtdLances: 0,
        aberturaIso: "2026-11-23T22:15:00Z",
        fechamentoIso: "2026-11-26T13:59:00Z",
        descricao: "<p>Obs: PLACA ABC1D23 CHASSI 9BWZZZ377VT004251 RENAVAM 12345678901</p>",
        metadados: { Placa: "QLI3F08", Chassi: "9C2KC2200JR107392", Renavam: "01132958218" },
        imagens: [],
      },
    });
    const parsed = parseOk(page);
    expect(parsed.marketValue).toBe(2_500_000);
    expect(parsed.description).not.toMatch(/ABC1D23|9BWZZZ377VT004251|12345678901/);
    expect(JSON.stringify(parsed.raw)).not.toMatch(
      /ABC1D23|9BWZZZ377VT004251|12345678901|QLI3F08|9C2KC2200JR107392|01132958218/,
    );
  });
});

describe("parsePatioListing — lote encerrado (Africa Twin 2020)", () => {
  const listing = parseOk(endedPage);

  it("CLOSED com lances vira sold com lance final e contagem de lances", () => {
    expect(listing).toMatchObject({
      externalId: "1100",
      status: "sold",
      sourceStatus: "CLOSED",
      currentBid: 2_830_000,
      minimumBid: 2_290_000,
      bidCount: 19,
    });
    expect(listing.vehicle.category).toBe("Motos");
  });
});

describe("parsePatioListing — moto aberta sem lances (Fazer 150)", () => {
  const listing = parseOk(motoPage);

  it("sem lances: currentBid é null, minimumBid preenchido e categoria Motos", () => {
    expect(listing).toMatchObject({
      externalId: "1446",
      status: "open",
      currentBid: null,
      minimumBid: 520_000,
      bidCount: 0,
    });
    expect(listing.vehicle.category).toBe("Motos");
  });
});

describe("situações do site e compatibilidade com raw legado", () => {
  const baseLote = {
    id: "2000",
    titulo: "VEICULO TESTE",
    auctionId: "52",
    numero: 5,
    categoria: "Veículos",
    status: "CLOSED",
    lanceAtualCentavos: null,
    lanceInicialCentavos: 1_500_000,
    qtdLances: 0,
    aberturaIso: "2026-11-20T12:00:00Z",
    fechamentoIso: "2026-11-25T12:00:00Z",
    descricao: "<p>Marca: FIAT</p>",
    imagens: [],
  };

  it("CLOSED sem lances é unsold; CONDITIONAL é conditional; DIRECT_SALE vira open antes e unknown depois do fim", () => {
    expect(parseOk(nextFlightPage({ initialLote: baseLote }))).toMatchObject({
      status: "unsold",
      currentBid: null,
      bidCount: 0,
    });
    expect(parseOk(nextFlightPage({ initialLote: { ...baseLote, status: "CONDITIONAL" } })).status).toBe("conditional");

    const directSalePage = nextFlightPage({ initialLote: { ...baseLote, status: "DIRECT_SALE" } });
    expect(parseOk(directSalePage, yardAddress, new Date("2026-11-24T00:00:00Z")).status).toBe("open");
    expect(parseOk(directSalePage, yardAddress, new Date("2026-11-26T00:00:00Z")).status).toBe("unknown");
  });

  it("patioDetailsFromRaw ainda lê raw legado (formato PHP) para o db:reparse", () => {
    const legacyRaw = {
      info: { brand: "TOYOTA" },
      notes: ["IPVA PAGO"],
      description: "Sem sinistro",
      live: {
        box_id: "991",
        situacao: 2,
        cronometro: {
          data: { fim: { dia: "02", mes: "10", ano: "2026", hora: "10", min: "18", seg: "00" } },
        },
      },
      yardAddress,
    };
    expect(patioDetailsFromRaw(legacyRaw, now)).toMatchObject({
      status: "sold",
      sourceStatus: "2",
      description: expect.stringContaining("IPVA PAGO"),
    });
  });
});

function fakeHttp(pages: Record<string, FetchOutcome>) {
  const calls: string[] = [];
  const http: SourceHttp = {
    get: (url) => {
      calls.push(`GET ${url}`);
      return Promise.resolve(pages[url] ?? { ok: false, status: 404, error: "HTTP 404" });
    },
    post: (url) => {
      calls.push(`POST ${url}`);
      return Promise.resolve({ ok: false, status: 405, error: "HTTP 405" });
    },
  };
  return { http, calls };
}

describe("patioSaoCarlosSource", () => {
  it("descoberta: pagina categorias 1 e 2 e mantém só abertos ou encerrados há até 3 dias", async () => {
    const cat1 = nextFlightPage({
      initialLotes: {
        itens: [
          { id: "1628", status: "OPEN", fechamentoIso: "2026-11-26T13:59:00Z" },
          { id: "1100", status: "CLOSED", fechamentoIso: "2026-11-23T13:25:00Z" },
          { id: "500", status: "CLOSED", fechamentoIso: "2026-11-01T13:00:00Z" },
        ],
        pagina: 1,
        porPagina: 12,
        total: 3,
      },
    });
    const cat2 = nextFlightPage({
      initialLotes: {
        itens: [{ id: "1446", status: "OPEN", fechamentoIso: "2026-11-27T13:11:00Z" }],
        pagina: 1,
        porPagina: 12,
        total: 1,
      },
    });
    const { http } = fakeHttp({
      [patioListUrl(1, 1)]: { ok: true, text: cat1 },
      [patioListUrl(2, 1)]: { ok: true, text: cat2 },
    });
    const discovery = await patioSaoCarlosSource.discover(http, now);
    expect(discovery.complete).toBe(true);
    expect(discovery.listings.map((item) => item.externalId).sort()).toEqual(["1100", "1446", "1628"]);
  });

  it("lista maior que o teto de páginas volta incompleta", async () => {
    const huge = nextFlightPage({
      initialLotes: {
        itens: [{ id: "1628", status: "OPEN", fechamentoIso: "2026-11-26T13:59:00Z" }],
        pagina: 1,
        porPagina: 12,
        total: 1200,
      },
    });
    const http: SourceHttp = {
      get: () => Promise.resolve({ ok: true, text: huge }),
      post: () => Promise.resolve({ ok: false, status: 405, error: "HTTP 405" }),
    };
    const discovery = await patioSaoCarlosSource.discover(http, now);
    expect(discovery.complete).toBe(false);
    expect(discovery.errors[0]?.error).toMatch(/100 páginas/);
  });

  it("HTML sem initialLotes (manutenção) volta descoberta incompleta", async () => {
    const http: SourceHttp = {
      get: () => Promise.resolve({ ok: true, text: "<html><body>Site em manutenção</body></html>" }),
      post: () => Promise.resolve({ ok: false, status: 405, error: "HTTP 405" }),
    };
    const discovery = await patioSaoCarlosSource.discover(http, now);
    expect(discovery.complete).toBe(false);
    expect(discovery.errors.length).toBeGreaterThan(0);
  });

  it("lê um lote juntando a página e o edital; na revisita reaproveita o endereço do pátio sem refazer o edital", async () => {
    const firstRun = fakeHttp({
      [patioListingUrl("1628")]: { ok: true, text: openPage },
      [patioEditalUrl("1628")]: { ok: true, text: fixture("edital.html") },
    });
    const first = await patioSaoCarlosSource.fetchListing(firstRun.http, "1628", now);
    if (!first.ok) throw new Error(first.error);
    expect(first.value.location.city).toBe("São Carlos");
    expect(firstRun.calls).toContain(`GET ${patioEditalUrl("1628")}`);

    const revisitRun = fakeHttp({ [patioListingUrl("1628")]: { ok: true, text: openPage } });
    const revisit = await patioSaoCarlosSource.fetchListing(revisitRun.http, "1628", now, first.value.raw);
    expect(revisit).toEqual(first);
    expect(revisitRun.calls).toEqual([`GET ${patioListingUrl("1628")}`]);
  });

  it("edital fora do ar não impede a leitura; 404 ou 410 na página do lote é gone", async () => {
    const { http } = fakeHttp({ [patioListingUrl("1628")]: { ok: true, text: openPage } });
    const fetched = await patioSaoCarlosSource.fetchListing(http, "1628", now);
    expect(fetched.ok && fetched.value.location.state).toBeNull();

    expect(await patioSaoCarlosSource.fetchListing(http, "777", now)).toMatchObject({ ok: false, gone: true });
    const removed: SourceHttp = { ...http, get: () => Promise.resolve({ ok: false, status: 410, error: "HTTP 410" }) };
    expect(await patioSaoCarlosSource.fetchListing(removed, "778", now)).toMatchObject({ ok: false, gone: true });
  });
});
