import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth", () => ({ requireUser: vi.fn() }));
vi.mock("@/server/db", () => ({ db: {} }));

import { toLotTarget } from "./evaluate";

function baseLot(analyses: { maxBidCents: number | null; isViable: boolean | null }[]) {
  return {
    id: "01990000-0000-7000-8000-000000000001",
    lotNumber: "42",
    brand: "Chevrolet",
    model: "Onix",
    modelYear: 2021,
    mileageKm: 45_000,
    currentBidCents: 3_000_000,
    analyses,
    listing: null,
  };
}

describe("toLotTarget", () => {
  it("retorna maxBid quando a última análise fixada é viável", () => {
    const target = toLotTarget(baseLot([{ maxBidCents: 3_800_000, isViable: true }]));
    expect(target.maxBid).toBe(3_800_000);
  });

  it("retorna maxBid null quando a última análise fixada é inviável (revoga limite anterior)", () => {
    const target = toLotTarget(baseLot([{ maxBidCents: null, isViable: false }]));
    expect(target.maxBid).toBeNull();
  });

  it("retorna maxBid null mesmo se houver valor residual quando isViable é false", () => {
    const target = toLotTarget(baseLot([{ maxBidCents: 3_800_000, isViable: false }]));
    expect(target.maxBid).toBeNull();
  });

  it("retorna maxBid null sem análises fixadas", () => {
    const target = toLotTarget(baseLot([]));
    expect(target.maxBid).toBeNull();
  });
});
