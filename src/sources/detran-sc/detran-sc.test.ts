import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { listingContractProblems } from "../shared/contract";
import type { FetchOutcome, SourceHttp } from "../types";
import { detranScSource } from ".";
import {
  ASTAVERO_SITE_KEYS,
  astaveroListUrl,
  astaveroLotApiUrl,
  buildDetranScListing,
  detranScDetailsFromRaw,
  detranScExternalId,
  detranScListingUrl,
  type DetranScLotRef,
  type DetranScRaw,
  parseAstaveroList,
  parseAstaveroLot,
  parseDetranScExternalId,
  parseDetranScName,
} from "./parse";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const now = new Date("2026-10-10T18:00:00Z");

const maxter = (lotId: string): DetranScLotRef => ({ site: "maxter", auctionId: "6aa1e41d859ddd3983188e07", lotId });
const krobel = (lotId: string): DetranScLotRef => ({ site: "krobel", auctionId: "6a8a6a7588b094974dbf7edc", lotId });
const LOTS = {
  car: { file: "lote-aberto-automovel.json", ref: maxter("6ab01aa1ad7cdf02559c8397") },
  moto: { file: "lote-aberto-motocicleta.json", ref: maxter("6ab083ddad7cdf02559d0e62") },
  salvage: { file: "lote-aberto-sucata.json", ref: maxter("6ab1c4c54cf1962c528a3fe3") },
  sold: { file: "lote-vendido.json", ref: krobel("6a8d0ef1b1f2547fec859f3f") },
  unsold: { file: "lote-sem-oferta.json", ref: krobel("6a8e66e1c9f163fc335066ae") },
  withdrawn: { file: "lote-retirado.json", ref: krobel("6a8d0e5fb1f2547fec859f17") },
} as const;

function raw(key: keyof typeof LOTS): DetranScRaw {
  const { file, ref } = LOTS[key];
  return parseFixture(file, ref);
}

function parseFixture(file: string, ref: DetranScLotRef): DetranScRaw {
  const parsed = parseAstaveroLot(fixture(file), ref);
  if (!parsed.ok || parsed.value === null) throw new Error(`${file}: lote não reconhecido`);
  return parsed.value;
}

function listing(key: keyof typeof LOTS) {
  const value = buildDetranScListing(raw(key), now);
  const externalId = detranScExternalId(LOTS[key].ref);
  expect(listingContractProblems(value, { externalId, url: detranScListingUrl(externalId) })).toEqual([]);
  return value;
}

describe("parseAstaveroList", () => {
  it("fica só com os lotes do Detran entre os lotes abertos do site", () => {
    const parsed = parseAstaveroList(fixture("lotes-maxter.json"), "maxter");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.truncated).toBe(false);
    expect(parsed.value.lots.length).toBeGreaterThan(3);
    expect(parsed.value.lots.every((lot) => lot.auctionId === "6aa1e41d859ddd3983188e07")).toBe(true);
    expect(parsed.value.lots).toContainEqual(LOTS.car.ref);
  });

  it("total maior que a lista é lista cortada; JSON fora do formato é falha", () => {
    const cut = fixture("lotes-maxter.json").replace('"count": 10,', '"count": 9999,');
    const parsed = parseAstaveroList(cut, "maxter");
    expect(parsed.ok && parsed.value.truncated).toBe(true);
    expect(parseAstaveroList("<html>504</html>", "maxter")).toEqual({ ok: false, error: "missing_data" });
    expect(parseAstaveroList('{"lotes":[{"id":1}]}', "maxter")).toEqual({ ok: false, error: "invalid_data" });
  });
});

describe("parseDetranScExternalId", () => {
  it("lê site, leilão e lote; recusa site desconhecido e id fora do formato do site", () => {
    const id = detranScExternalId(LOTS.sold.ref);
    expect(id).toBe("krobel-6a8a6a7588b094974dbf7edc-6a8d0ef1b1f2547fec859f3f");
    expect(parseDetranScExternalId(id)).toEqual(LOTS.sold.ref);
    expect(detranScListingUrl(id)).toBe(
      "https://www.krobelleiloes.com.br/pregao/6a8a6a7588b094974dbf7edc/6a8d0ef1b1f2547fec859f3f",
    );
    expect(parseDetranScExternalId("outro-6a8a6a7588b094974dbf7edc-6a8d0ef1b1f2547fec859f3f")).toBeNull();
    expect(parseDetranScExternalId("krobel-123-456")).toBeNull();
  });
});

describe("parseDetranScName", () => {
  it.each([
    ["AUTOMÓVEL FIAT/PALIO EX Ano: 2001/2002", "AUTOMOVEL", "FIAT/PALIO EX", 2001, 2002],
    ["SUCATA GM/CORSA WIND Ano: 1999/1999", "SUCATA", "GM/CORSA WIND", 1999, 1999],
    ["SEMI-REBOQUE R/GUERRA AG GR Ano: 2010/2010", "SEMI-REBOQUE", "R/GUERRA AG GR", 2010, 2010],
    ["TRATOR XYZ/ABC", null, "TRATOR XYZ/ABC", null, null],
  ])("%s", (name, type, vehicle, manufactureYear, modelYear) => {
    expect(parseDetranScName(name)).toEqual({ type, vehicle, manufactureYear, modelYear });
  });
});

describe("buildDetranScListing", () => {
  it("lote aberto com lance: marca, modelo, anos, pátio, comissão, fotos e lance atual", () => {
    const value = listing("car");
    expect(value).toMatchObject({
      lotNumber: "8408",
      title: "RENAULT/SCENIC RT1.6 16V",
      vehicle: {
        brand: "RENAULT",
        model: "SCENIC RT1.6 16V",
        manufactureYear: 2002,
        modelYear: 2002,
        category: "Carros",
      },
      auction: { externalId: "6aa1e41d859ddd3983188e07", name: "Leilão Detran-SC de 19/10/2026 (Maxter Leilões)" },
      sellerName: "DETRAN/SC",
      location: { city: "Lages", state: "SC" },
      status: "open",
      sourceStatus: "Aberto",
      currentBid: 277_000,
      minimumBid: 277_000,
      bidCount: 1,
      marketValue: null,
      costs: { commissionRate: 500 },
      endsAt: new Date("2026-10-19T12:00:00Z"),
      startsAt: new Date("2026-10-07T12:00:00Z"),
    });
    expect(value.location.yardName).toMatch(/^LAGES - /);
    expect(value.photoUrls.length).toBe(10);
  });

  it("lote sem lance: sem lance atual; moto pela palavra do tipo", () => {
    expect(listing("moto")).toMatchObject({
      vehicle: { brand: "HONDA", model: "CG 125 FAN", category: "Motos" },
      currentBid: null,
      bidCount: 0,
      minimumBid: 144_000,
    });
  });

  it("sucata: categoria Sucatas e dano declarado", () => {
    expect(listing("salvage")).toMatchObject({
      title: "SUCATA GM/CORSA WIND",
      vehicle: { brand: "GM", category: "Sucatas" },
      condition: { damageLevel: "salvage" },
    });
  });

  it("vendido: o maior lance é o preço final e o fim é o fechamento do lote", () => {
    expect(listing("sold")).toMatchObject({
      status: "sold",
      currentBid: 615_000,
      bidCount: 13,
      minimumBid: 255_000,
      endsAt: new Date("2026-09-21T12:00:39Z"),
      vehicle: { brand: "FIAT", model: "PALIO EX", category: "Carros" },
    });
  });

  it("sem oferta e retirado (com o motivo do Detran)", () => {
    expect(listing("unsold")).toMatchObject({ status: "unsold", currentBid: null, bidCount: 0 });
    const withdrawn = listing("withdrawn");
    expect(withdrawn).toMatchObject({
      status: "withdrawn",
      vehicle: { brand: "CHEVROLET", model: "ONIX PLUS 10MT LT2" },
    });
    expect(withdrawn.description).toMatch(/^Motivo da retirada: Determinação de Retirada Pelo Detran/);
    expect(withdrawn.photoUrls).toEqual([]);
  });

  it("vendido sem lance não tem preço final: desconhecido; situação nova segue aberta até o pregão", () => {
    expect(buildDetranScListing({ ...raw("sold"), bids: [] }, now).status).toBe("unknown");
    const novel = { ...raw("car"), status: "Suspenso" };
    expect(buildDetranScListing(novel, now).status).toBe("open");
    expect(buildDetranScListing(novel, new Date("2026-10-20T00:00:00Z")).status).toBe("unknown");
  });
});

describe("dados que não são guardados", () => {
  it("o dado bruto não tem placa, motor, chassi nem nada de quem deu lance", () => {
    for (const { file, ref } of Object.values(LOTS)) {
      const value = buildDetranScListing(parseFixture(file, ref), now);
      const text = JSON.stringify(value);
      expect(text).not.toMatch(/Placa|Motor:|Chassi|Rem:|\[removido\]|"ip"|"rf"|"alias"|"nome"/);
      expect(value.description ?? "").not.toMatch(/AAA0A00|9AAAA00AA0A000000|MOTOR0000000/);
    }
    expect(JSON.stringify(raw("sold"))).not.toContain("AAA0A00");
  });
});

describe("detranScDetailsFromRaw", () => {
  it("rederiva situação, descrição e condição do dado guardado", () => {
    expect(detranScDetailsFromRaw(raw("salvage"), now)).toEqual({
      description: null,
      condition: { damageLevel: "salvage", flags: [], inspection: null, inspectionNotes: null },
      status: "open",
      sourceStatus: "Aberto",
    });
    expect(detranScDetailsFromRaw({ outro: true }, now)).toBeNull();
  });
});

function fakeHttp(
  responses: Record<string, FetchOutcome | ((form: Readonly<Record<string, string>>) => FetchOutcome)>,
) {
  const calls: { url: string; form: Readonly<Record<string, string>> }[] = [];
  const http: SourceHttp = {
    get: () => Promise.reject(new Error("o adaptador não usa GET")),
    post: (url, form) => {
      calls.push({ url, form });
      const response = responses[url];
      const outcome = typeof response === "function" ? response(form) : response;
      return Promise.resolve(outcome ?? { ok: false, status: 404, error: "HTTP 404" });
    },
  };
  return { http, calls };
}

describe("detranScSource", () => {
  it("descobre os lotes do Detran em cada site; site fora do ar deixa a descoberta incompleta", async () => {
    const { http, calls } = fakeHttp({
      [astaveroListUrl("maxter")]: { ok: true, text: fixture("lotes-maxter.json") },
      [astaveroListUrl("krobel")]: { ok: true, text: '{"erro":false,"lotes":[],"pag":{"count":0}}' },
      [astaveroListUrl("deltta")]: { ok: true, text: '{"erro":false,"lotes":[],"pag":{"count":0}}' },
      [astaveroListUrl("damiani")]: { ok: false, status: 503, error: "HTTP 503" },
    });
    const discovery = await detranScSource.discover(http, now);
    expect(calls.map((call) => call.url)).toEqual(ASTAVERO_SITE_KEYS.map(astaveroListUrl));
    expect(discovery.complete).toBe(false);
    expect(discovery.errors).toEqual([{ url: astaveroListUrl("damiani"), error: "HTTP 503" }]);
    expect(discovery.listings).toContainEqual({
      externalId: detranScExternalId(LOTS.car.ref),
      url: detranScListingUrl(detranScExternalId(LOTS.car.ref)),
      lastModified: null,
    });
  });

  it("lê o lote pela consulta do site certo; lote desconhecido é página fora do ar", async () => {
    const lotApi = astaveroLotApiUrl("krobel");
    const { http, calls } = fakeHttp({
      [lotApi]: (form) =>
        form.id === LOTS.sold.ref.lotId
          ? { ok: true, text: fixture("lote-vendido.json") }
          : { ok: true, text: '{"lote":null,"prog":null,"pregao":null}' },
    });
    const sold = await detranScSource.fetchListing(http, detranScExternalId(LOTS.sold.ref), now);
    expect(sold.ok && sold.value.currentBid).toBe(615_000);
    expect(calls).toEqual([{ url: lotApi, form: { id: LOTS.sold.ref.lotId } }]);

    const missing = await detranScSource.fetchListing(
      http,
      detranScExternalId(krobel("6a8d0ef1b1f2547fec859fff")),
      now,
    );
    expect(missing).toEqual({ ok: false, gone: true, error: "lote desconhecido pelo site" });
  });

  it("id fora do formato não vai ao site; lote de outro id é falha comum", async () => {
    const { http, calls } = fakeHttp({
      [astaveroLotApiUrl("maxter")]: { ok: true, text: fixture("lote-vendido.json") },
    });
    expect(await detranScSource.fetchListing(http, "maxter-xyz", now)).toMatchObject({ ok: false, gone: false });
    expect(calls).toEqual([]);
    expect(await detranScSource.fetchListing(http, detranScExternalId(LOTS.car.ref), now)).toEqual({
      ok: false,
      gone: false,
      error: "invalid_data",
    });
  });
});
