import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { listingContractProblems } from "../shared/contract";
import type { FetchOutcome, SourceHttp } from "../types";
import { detranMgSource } from ".";
import {
  buildDetranListing,
  categoryOfVehicle,
  DETRAN_MG_BASE_URL,
  DETRAN_MG_LIVE_URL,
  detranAuctionUrl,
  detranDetailsFromRaw,
  detranLotUrl,
  type DetranRaw,
  parseDetranAuctionPage,
  parseDetranHome,
  parseDetranLive,
  parseDetranLotPage,
  redactPersonalIds,
  snapshotLive,
  splitDetranVehicle,
} from "./parse";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const liveJson = fixture("situacao.json");
const now = new Date("2026-10-09T15:00:00Z");
const pocos = { id: "3599", year: "2026" };

function live(id: string) {
  const parsed = parseDetranLive(liveJson);
  const lot = parsed.ok ? parsed.value.get(id) : undefined;
  if (!lot) throw new Error(`lote ${id} fora da fixture`);
  return lot;
}

function pocosList() {
  const list = parseDetranAuctionPage(fixture("lista-pocos.html"), "3599");
  if (!list) throw new Error("lista não reconhecida");
  return list;
}

function rawOf(lotId: string, liveId: string, page = parseDetranLotPage(fixture("lote-aberto.html"))): DetranRaw {
  const list = pocosList();
  return {
    lotId,
    auction: list.auction,
    card: list.cards.find((card) => card.lotId === lotId) ?? null,
    page,
    live: snapshotLive(live(liveId), null, now),
  };
}

describe("parseDetranHome", () => {
  it("lê os leilões abertos da página inicial, sem repetir", () => {
    const auctions = parseDetranHome(fixture("inicio.html"));
    expect(auctions).toHaveLength(36);
    expect(auctions).toContainEqual(pocos);
    expect(new Set(auctions.map((auction) => auction.id)).size).toBe(auctions.length);
  });
});

describe("parseDetranAuctionPage", () => {
  it("lê o leilão (número, município, pátio) e os cartões dos lotes", () => {
    const { auction, cards, lastPage } = pocosList();
    expect(auction).toEqual({
      id: "3599",
      number: "1875",
      city: "POCOS DE CALDAS",
      yard: "AUTO SOCORRO POCOS DE CALDAS LTDA",
    });
    expect(lastPage).toBe(1);
    expect(cards).toHaveLength(15);
    expect(cards[1]).toEqual({
      lotId: "325919",
      lotNumber: "2",
      condition: "CONSERVADO",
      vehicle: "HONDA/CG 125 FAN KS",
      year: 2012,
      value: "R$ 1.500,00",
      photo: `${DETRAN_MG_BASE_URL}/Imagens/visualizar/leiloes/leilao_3599/img_325919_1.jpg`,
    });
  });

  it("cartão sem marca e modelo fica só com o ano", () => {
    expect(pocosList().cards[0]).toMatchObject({ lotNumber: "1", vehicle: null, year: 2024 });
  });

  it("apaga o CPF que o site escreve no nome do pátio", () => {
    const list = parseDetranAuctionPage(fixture("lista-patio-cpf.html"), "3483");
    expect(list?.auction.yard).toBe("DEYVID ALAN COSTA");
    expect(list?.auction.city).toBe("PIUMHI");
  });

  it("página inicial (leilão encerrado redireciona para ela) não é lista", () => {
    expect(parseDetranAuctionPage(fixture("inicio.html"), "3100")).toBeNull();
  });

  it("lê a última página dos links de paginação", () => {
    const html = `${fixture("lista-pocos.html")}<a href="/lotes/lista-lotes/3599/2026?page=3&amp;limit=100">3</a>`;
    expect(parseDetranAuctionPage(html, "3599")?.lastPage).toBe(3);
  });
});

describe("parseDetranLotPage", () => {
  it("lê a ficha e as fotos do lote aberto", () => {
    const page = parseDetranLotPage(fixture("lote-aberto.html"));
    expect(page?.fields).toMatchObject({
      "MARCA/MODELO": "HONDA/CG 125 FAN KS",
      "ANO DO MODELO": "2012",
      COMBUSTIVEL: "GASOLINA",
      COR: "PRETA",
    });
    expect(page?.photos).toHaveLength(6);
  });

  it("lote encerrado perde fotos e anos (o site mostra '-')", () => {
    const page = parseDetranLotPage(fixture("lote-encerrado.html"));
    expect(page?.photos).toEqual([]);
    expect(page?.fields["ANO DO MODELO"]).toBeUndefined();
    expect(page?.fields["MARCA/MODELO"]).toBe("VW/GOL 1000I");
  });

  it("página que não é de lote volta nula", () => {
    expect(parseDetranLotPage(fixture("inicio.html"))).toBeNull();
  });
});

describe("parseDetranLive", () => {
  it("lê situação, valor e tempo de vários lotes", () => {
    expect(live("325919")).toMatchObject({ status: "1", valor: "1500.00", arrematante: null });
    expect(live("280000")).toMatchObject({ status: "3", valor: "3800.00" });
  });

  it("resposta vazia do site ('[]') é mapa vazio; erro do site é falha", () => {
    expect(parseDetranLive("[]")).toEqual({ ok: true, value: new Map() });
    expect(parseDetranLive('{"error":true,"msg":"Requisição inválida."}')).toEqual({
      ok: false,
      error: "missing_data",
    });
    expect(parseDetranLive("<html>")).toEqual({ ok: false, error: "missing_data" });
  });
});

describe("buildDetranListing", () => {
  it("lote aberto: veículo, leilão, local, lance inicial e fim pelo tempo restante", () => {
    const listing = buildDetranListing(rawOf("325919", "325919"), now);
    expect(listing).toMatchObject({
      externalId: "3599-325919",
      url: detranLotUrl("325919"),
      lotNumber: "2",
      title: "HONDA/CG 125 FAN KS 2012",
      vehicle: { brand: "HONDA", model: "CG 125 FAN KS", modelYear: 2012, category: "Motos", fuel: "GASOLINA" },
      auction: { externalId: "3599", name: "Leilão 1875 - POCOS DE CALDAS" },
      location: { city: "POCOS DE CALDAS", state: "MG", yardName: "AUTO SOCORRO POCOS DE CALDAS LTDA" },
      status: "open",
      currentBid: null,
      minimumBid: 150_000,
      marketValue: null,
      sellerName: "DETRAN/MG",
    });
    const tempo = live("325919").tempo ?? 0;
    expect(listing.endsAt?.getTime()).toBe(Math.round((now.getTime() + tempo * 1000) / 60_000) * 60_000);
    expect(listing.photoUrls).toHaveLength(6);
    expect(listingContractProblems(listing, { externalId: "3599-325919", url: detranLotUrl("325919") })).toEqual([]);
  });

  it("vendido: valor final com arrematante (o documento mascarado não é guardado)", () => {
    const listing = buildDetranListing(rawOf("325919", "280000"), now);
    expect(listing).toMatchObject({ status: "sold", currentBid: 380_000, sourceStatus: "3" });
    expect(JSON.stringify(listing.raw)).not.toMatch(/xxx/);
  });

  it("encerrado sem lance (valor nulo) é não vendido; cancelado é retirado", () => {
    expect(buildDetranListing(rawOf("325919", "270042"), now)).toMatchObject({ status: "unsold", currentBid: null });
    expect(buildDetranListing(rawOf("325919", "290031"), now)).toMatchObject({ status: "withdrawn" });
  });

  it("sucata vira condição 'salvage'", () => {
    const sucata = pocosList().cards.find((card) => card.condition === "SUCATA");
    if (!sucata) throw new Error("fixture sem sucata");
    const listing = buildDetranListing({ ...rawOf(sucata.lotId, "325919"), page: null }, now);
    expect(listing.condition.damageLevel).toBe("salvage");
    expect(listing.vehicle.modelYear).toBe(sucata.year);
  });

  it("detailsFromRaw rederiva situação e condição do dado guardado", () => {
    const raw = rawOf("325919", "280000");
    expect(detranDetailsFromRaw(raw, now)).toMatchObject({ status: "sold", sourceStatus: "3" });
    expect(detranDetailsFromRaw({ outro: true }, now)).toBeNull();
  });
});

describe("splitDetranVehicle e categoryOfVehicle", () => {
  it.each([
    ["VW/GOL 1.6", "VW", "GOL 1.6", "Carros"],
    ["I/FIAT SIENA FIRE FLEX", "FIAT", "SIENA FIRE FLEX", "Carros"],
    ["IMP/GM ASTRA GLS", "GM", "ASTRA GLS", "Carros"],
    ["JTA/SUZUKI EN125 YES", "SUZUKI", "EN125 YES", "Motos"],
    ["JTA-SUZUKI/GSR150I", "SUZUKI", "GSR150I", "Motos"],
    ["I/M.BENZ GLK220CDI", "MERCEDES-BENZ", "GLK220CDI", "Carros"],
    ["I/CHEV SONIC 16MH LTZ EF", "CHEVROLET", "SONIC 16MH LTZ EF", "Carros"],
    ["MMC/PAJERO TR4 FL 2WD HP", "MITSUBISHI", "PAJERO TR4 FL 2WD HP", "Carros"],
    ["HONDA/CG 125 FAN KS", "HONDA", "CG 125 FAN KS", "Motos"],
    ["HONDA/CIVIC LXS FLEX", "HONDA", "CIVIC LXS FLEX", "Carros"],
    ["VW/SAVEIRO 1.6 CS", "VW", "SAVEIRO 1.6 CS", "Utilitarios"],
    ["VW/8.150 DELIVERY", "VW", "8.150 DELIVERY", "Pesados"],
    ["IROS/ONE 125", "IROS", "ONE 125", "Motos"],
    ["ARTESANAL/REBOQUE", "ARTESANAL", "REBOQUE", null],
  ])("%s → %s · %s · %s", (text, brand, model, category) => {
    expect(splitDetranVehicle(text)).toEqual({ brand, model });
    expect(categoryOfVehicle(brand, model)).toBe(category);
  });

  it("sem barra não há marca", () => {
    expect(splitDetranVehicle("OUTROS")).toEqual({ brand: null, model: "OUTROS" });
    expect(categoryOfVehicle(null, "OUTROS")).toBeNull();
  });
});

describe("redactPersonalIds", () => {
  it("apaga CPF e CNPJ, com ou sem rótulo", () => {
    expect(redactPersonalIds("FULANO CPF 123.456.789-09")).toBe("FULANO");
    expect(redactPersonalIds("PATIO X 12.345.678/0001-90 LTDA")).toBe("PATIO X LTDA");
    expect(redactPersonalIds("AUTO SOCORRO 381 LTDA")).toBe("AUTO SOCORRO 381 LTDA");
  });
});

function fakeHttp(pages: Record<string, FetchOutcome>) {
  const calls: string[] = [];
  const http: SourceHttp = {
    get: (url) => {
      calls.push(url);
      if (url.startsWith(DETRAN_MG_LIVE_URL)) return Promise.resolve({ ok: true, text: liveJson });
      return Promise.resolve(pages[url] ?? { ok: false, status: 404, error: "HTTP 404" });
    },
    post: () => Promise.reject(new Error("o adaptador não usa POST")),
  };
  return { http, calls };
}

const home = { ok: true as const, text: '<a href="/lotes/lista-lotes/3599/2026">Leilão</a> Sistema de Leilão' };
const listPage = { ok: true as const, text: fixture("lista-pocos.html") };

describe("detranMgSource", () => {
  it("descobre os lotes das listas dos leilões abertos", async () => {
    const { http } = fakeHttp({ [`${DETRAN_MG_BASE_URL}/`]: home, [detranAuctionUrl(pocos, 1)]: listPage });
    const discovery = await detranMgSource.discover(http, now);
    expect(discovery.complete).toBe(true);
    expect(discovery.listings).toHaveLength(15);
    expect(discovery.listings[1]).toEqual({
      externalId: "3599-325919",
      url: detranLotUrl("325919"),
      lastModified: null,
    });
  });

  it("lista que falha deixa a descoberta incompleta", async () => {
    const { http } = fakeHttp({ [`${DETRAN_MG_BASE_URL}/`]: home });
    const discovery = await detranMgSource.discover(http, now);
    expect(discovery).toMatchObject({ complete: false, listings: [] });
  });

  it("lote novo: lista e situação vêm da memória da execução; a página é lida uma vez", async () => {
    const { http, calls } = fakeHttp({
      [`${DETRAN_MG_BASE_URL}/`]: home,
      [detranAuctionUrl(pocos, 1)]: listPage,
      [detranLotUrl("325919")]: { ok: true, text: fixture("lote-aberto.html") },
      [detranLotUrl("325918")]: { ok: true, text: fixture("lote-aberto.html") },
    });
    await detranMgSource.discover(http, now);
    const first = await detranMgSource.fetchListing(http, "3599-325919", now, null);
    await detranMgSource.fetchListing(http, "3599-325918", now, null);
    expect(first.ok && first.value.status).toBe("open");
    // Uma consulta de situação para os lotes do leilão, não uma por lote.
    expect(calls.filter((url) => url.startsWith(DETRAN_MG_LIVE_URL))).toHaveLength(1);
    expect(calls.filter((url) => url === detranAuctionUrl(pocos, 1))).toHaveLength(1);
  });

  it("revisita depois do fim: leilão fora do início, parte do dado guardado e só pede a situação", async () => {
    const stored = rawOf("280000", "325919");
    const { http, calls } = fakeHttp({ [`${DETRAN_MG_BASE_URL}/`]: { ok: true, text: "Sistema de Leilão" } });
    const fetched = await detranMgSource.fetchListing(http, "3599-280000", now, stored);
    expect(fetched.ok && fetched.value).toMatchObject({
      status: "sold",
      currentBid: 380_000,
      location: { city: "POCOS DE CALDAS" },
      vehicle: { modelYear: 2012 },
    });
    expect(fetched.ok && fetched.value.endsAt?.toISOString()).toBe(stored.live.endsAt);
    expect(calls.some((url) => url.startsWith(`${DETRAN_MG_BASE_URL}/lotes/`))).toBe(false);
  });

  it("lote desconhecido do site é `gone`; id fora do formato é falha", async () => {
    const { http } = fakeHttp({ [`${DETRAN_MG_BASE_URL}/`]: home, [detranAuctionUrl(pocos, 1)]: listPage });
    expect(await detranMgSource.fetchListing(http, "3599-1", now, null)).toMatchObject({ ok: false, gone: true });
    expect(await detranMgSource.fetchListing(http, "abc", now, null)).toMatchObject({ ok: false, gone: false });
  });
});
