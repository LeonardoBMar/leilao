import { describe, expect, it } from "vitest";

import { bps, cents } from "../money";
import { auctionOrigin, planTracker, shouldSyncBid, type TrackerListing, trackerMissing } from "./tracker";

const now = new Date("2026-09-30T12:00:00Z");
const checkedAt = new Date("2026-09-30T11:00:00Z");

const listing = (overrides: Partial<TrackerListing> = {}): TrackerListing => ({
  sourceId: "leilo",
  sourceName: "Leilo",
  externalId: "2d995c71-59b6-4e18-b34a-010b51719219",
  url: "https://leilo.com.br/lote/2d995c71-59b6-4e18-b34a-010b51719219/",
  lotNumber: "155",
  brand: "CHEVROLET",
  model: "ONIX PLUS JOY BLACK",
  fipeName: "GM - Chevrolet JOY Plus Black Ed.1.0 8V 4p Flex Mec.",
  modelYear: 2020,
  manufactureYear: 2019,
  mileageKm: 81_000,
  recoveryType: "Recuperado de Financiamento",
  auctionExternalId: "3578d50c-bc14-11f1-98d3-0242ac500003",
  auctionName: "Leilão Fecha Mês – Prorrogação 30/09/2026",
  auctionStartsAt: new Date("2026-10-01T12:30:00Z"),
  startsAt: new Date("2026-09-25T12:00:00Z"),
  endsAt: new Date("2026-10-01T15:00:00Z"),
  status: "open",
  currentBid: cents(2_900_000),
  minimumBid: cents(2_800_000),
  marketValue: cents(5_291_800),
  commissionRate: bps(500),
  dispatcherFee: cents(0),
  removalFee: cents(55_000),
  storageFee: cents(235_000),
  inspectionFee: cents(25_000),
  otherFees: cents(0),
  lastCheckedAt: checkedAt,
  ...overrides,
});

function plan(overrides: Partial<TrackerListing> = {}) {
  const result = planTracker(listing(overrides), now);
  if (!result.ok) throw new Error(`faltou ${result.missing.join(", ")}`);
  return result.value;
}

describe("planTracker — leilão", () => {
  it("um leilão por leilão da fonte, com o leiloeiro e a origem da retomada", () => {
    expect(plan().auction).toEqual({
      sourceId: "leilo",
      externalId: "3578d50c-bc14-11f1-98d3-0242ac500003",
      name: "Leilão Fecha Mês – Prorrogação 30/09/2026",
      auctioneer: "Leilo",
      origin: "financial",
      status: "scheduled",
      startsAt: new Date("2026-10-01T12:30:00Z"),
    });
  });

  it("situação: em andamento depois do início; encerrado depois do fim ou com desfecho", () => {
    expect(plan({ auctionStartsAt: new Date("2026-09-30T10:00:00Z") }).auction.status).toBe("in_progress");
    expect(plan({ endsAt: new Date("2026-09-30T11:59:00Z") }).auction.status).toBe("finished");
    expect(plan({ status: "sold" }).auction.status).toBe("finished");
  });

  it("sem data do leilão, usa o início e depois o fim do lote", () => {
    expect(plan({ auctionStartsAt: null }).auction.startsAt).toEqual(new Date("2026-09-25T12:00:00Z"));
    expect(plan({ auctionStartsAt: null, startsAt: null }).auction.startsAt).toEqual(new Date("2026-10-01T15:00:00Z"));
  });
});

describe("planTracker — lote", () => {
  it("copia o veículo e o lance, com a hora da leitura do coletor", () => {
    expect(plan().lot).toEqual({
      lotNumber: "155",
      brand: "CHEVROLET",
      model: "ONIX PLUS JOY BLACK",
      vehicleVersion: "GM - Chevrolet JOY Plus Black Ed.1.0 8V 4p Flex Mec.",
      modelYear: 2020,
      manufactureYear: 2019,
      mileageKm: 81_000,
      startingBid: 2_800_000,
      currentBid: 2_900_000,
      currentBidObservedAt: checkedAt,
      lotUrl: "https://leilo.com.br/lote/2d995c71-59b6-4e18-b34a-010b51719219/",
    });
  });

  it("sem lance: lance atual e data vazios", () => {
    const { lot } = plan({ currentBid: null });
    expect(lot.currentBid).toBeNull();
    expect(lot.currentBidObservedAt).toBeNull();
  });

  it("respeita os limites do formulário e do banco", () => {
    const { lot } = plan({ model: "X".repeat(100), manufactureYear: 2021, lotNumber: null });
    expect(lot.model).toHaveLength(80);
    expect(lot.manufactureYear).toBeNull();
    expect(lot.lotNumber).toBe("2d995c71-59b6-4e18-b34a-010b51");
  });

  it("sem marca, modelo, ano ou leilão: não vira lote e diz o que falta", () => {
    expect(planTracker(listing({ brand: null, modelYear: null }), now)).toEqual({
      ok: false,
      missing: ["brand", "model_year"],
    });
    expect(planTracker(listing({ auctionExternalId: " " }), now)).toEqual({ ok: false, missing: ["auction"] });
  });
});

describe('trackerMissing — quando o cartão oferece "Adicionar à análise"', () => {
  it("anúncio completo: nada falta", () => {
    expect(trackerMissing(listing())).toEqual([]);
  });

  it("mesma exigência de planTracker: texto em branco e ano fora da faixa contam como ausentes", () => {
    expect(trackerMissing(listing({ brand: "  ", modelYear: 1800 }))).toEqual(["brand", "model_year"]);
    expect(trackerMissing(listing({ auctionStartsAt: null, startsAt: null, endsAt: null }))).toEqual(["auction"]);
  });
});

describe("planTracker — sugestões para a análise (D-30)", () => {
  it("valor de mercado, comissão e custos da fonte; depósito e vistoria somam em outras taxas", () => {
    expect(plan().suggestions).toEqual({
      marketValue: 5_291_800,
      commissionRate: 500,
      documentationCost: 0,
      transportCost: 55_000,
      otherFees: 260_000,
      referenceDate: checkedAt,
    });
  });

  it("o que a fonte não informa fica vazio, nunca zero inventado", () => {
    const { suggestions } = plan({
      marketValue: null,
      commissionRate: null,
      dispatcherFee: null,
      removalFee: null,
      storageFee: null,
      inspectionFee: null,
      otherFees: null,
    });
    expect(suggestions).toMatchObject({
      marketValue: null,
      commissionRate: null,
      documentationCost: null,
      transportCost: null,
      otherFees: null,
    });
  });
});

describe("auctionOrigin", () => {
  it.each([
    ["Recuperado de Financiamento", "financial"],
    ["Recuperado de Seguradora", "insurer"],
    ["Frota", "other"],
    ["LEILOSHOP", "other"],
    ["-", "unknown"],
    [null, "unknown"],
  ] as const)("%s → %s", (recoveryType, origin) => {
    expect(auctionOrigin(recoveryType)).toBe(origin);
  });
});

describe("shouldSyncBid", () => {
  const before = new Date("2026-09-30T10:00:00Z");
  const after = new Date("2026-09-30T13:00:00Z");

  it("lance novo e leitura mais recente: atualiza", () => {
    expect(
      shouldSyncBid(
        { currentBid: cents(100), currentBidObservedAt: before },
        { currentBid: cents(200), lastCheckedAt: checkedAt },
      ),
    ).toBe(true);
    expect(
      shouldSyncBid(
        { currentBid: null, currentBidObservedAt: null },
        { currentBid: cents(200), lastCheckedAt: checkedAt },
      ),
    ).toBe(true);
  });

  it("mesmo lance: não mexe (a data do lote só muda quando o valor muda)", () => {
    expect(
      shouldSyncBid(
        { currentBid: cents(200), currentBidObservedAt: before },
        { currentBid: cents(200), lastCheckedAt: checkedAt },
      ),
    ).toBe(false);
  });

  it("lance digitado depois da leitura do coletor: fica até a próxima leitura", () => {
    expect(
      shouldSyncBid(
        { currentBid: cents(300), currentBidObservedAt: after },
        { currentBid: cents(200), lastCheckedAt: checkedAt },
      ),
    ).toBe(false);
  });

  it("anúncio sem lance não apaga o lance do lote", () => {
    expect(
      shouldSyncBid(
        { currentBid: cents(300), currentBidObservedAt: before },
        { currentBid: null, lastCheckedAt: checkedAt },
      ),
    ).toBe(false);
  });
});
