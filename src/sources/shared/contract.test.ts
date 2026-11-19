import { describe, expect, it } from "vitest";

import type { ListingInput } from "@/domain/listings/types";
import { type Bps, bps, cents, MAX_CENTS } from "@/domain/money";

import { LEILO_IMAGE_ORIGIN } from "../image-origins";
import { listingContractProblems } from "./contract";

const BASE_URL = "https://leilo.com.br/lote/0e06aced-c58f-452b-9050-661048524204/";
const BASE_ID = "0e06aced-c58f-452b-9050-661048524204";

function makeListing(overrides: Partial<ListingInput> = {}): ListingInput {
  return {
    externalId: BASE_ID,
    url: BASE_URL,
    lotNumber: "1",
    title: "FIAT UNO 2020",
    vehicle: {
      brand: "FIAT",
      model: "UNO",
      fipeCode: null,
      fipeName: null,
      modelYear: 2020,
      manufactureYear: 2019,
      mileageKm: 50_000,
      fuel: "Flex",
      color: "Branco",
      category: "Carros",
      recoveryType: null,
      hasKey: true,
    },
    auction: { externalId: "10", name: "Leilão 10", startsAt: null },
    sellerName: null,
    description: null,
    condition: { damageLevel: null, flags: [], inspection: null, inspectionNotes: null },
    startsAt: null,
    endsAt: new Date("2026-10-10T15:00:00Z"),
    location: { yardName: null, city: null, state: null, address: null },
    status: "open",
    sourceStatus: null,
    currentBid: null,
    minimumBid: cents(1_000_000),
    bidCount: 0,
    marketValue: null,
    costs: {
      commissionRate: bps(500),
      dispatcherFee: null,
      removalFee: null,
      storageFee: null,
      inspectionFee: null,
      otherFees: null,
    },
    photoUrls: [`${LEILO_IMAGE_ORIGIN}/foto.jpg`],
    raw: {},
    ...overrides,
  };
}

describe("listingContractProblems", () => {
  it("aceita anúncio válido dentro dos limites de int4 e bps", () => {
    expect(listingContractProblems(makeListing(), { externalId: BASE_ID, url: BASE_URL })).toEqual([]);
  });

  it("rejeita centavos, comissão, km ou anos fora dos limites do banco", () => {
    const base = makeListing();
    const invalid = makeListing({
      minimumBid: cents(MAX_CENTS + 1),
      costs: { ...base.costs, commissionRate: 10_001 as Bps },
      vehicle: { ...base.vehicle, mileageKm: -1, modelYear: 1890, manufactureYear: 2150 },
    });
    const problems = listingContractProblems(invalid, { externalId: BASE_ID, url: BASE_URL });
    expect(problems).toEqual([
      "lance mínimo fora da faixa de centavos",
      "comissão fora da faixa (0..10.000 bps)",
      "quilometragem fora da faixa",
      "ano do modelo inválido (1890)",
      "ano de fabricação inválido (2150)",
    ]);
  });
});
