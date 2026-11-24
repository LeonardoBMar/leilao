import { beforeEach, describe, expect, it, vi } from "vitest";

const { watchFindManyMock, listingFindManyMock, prefFindManyMock, alertCreateManyMock } = vi.hoisted(() => ({
  watchFindManyMock: vi.fn(),
  listingFindManyMock: vi.fn(),
  prefFindManyMock: vi.fn(),
  alertCreateManyMock: vi.fn(),
}));

vi.mock("../db", () => ({
  db: {
    watch: { findMany: watchFindManyMock },
    listing: { findMany: listingFindManyMock },
    userPreference: { findMany: prefFindManyMock },
    alert: { createMany: alertCreateManyMock },
  },
}));

import { createAlerts } from "./alerts";

const NOW = new Date("2026-11-24T12:00:00Z");
const ALERTS_FROM = new Date("2026-11-24T00:00:00Z");
const BH = { latitude: -19.9167, longitude: -43.9345 };
const SAO_CARLOS = { latitude: -22.0087, longitude: -47.8909 };

const baseWatch = {
  search: null,
  yearFrom: null,
  yearTo: null,
  minPriceCents: null,
  maxPriceCents: null,
  maxMarketPct: null,
  maxMileageKm: null,
  radiusKm: 100,
  categories: ["carros"],
  condition: "qualquer",
  hide: [],
  sources: [],
  origins: [],
  fuels: [],
  keyOnly: false,
  alertsFrom: ALERTS_FROM,
};

const baseListing = {
  sourceId: "leilo",
  firstSeenAt: new Date("2026-11-24T10:00:00Z"),
  title: "VW GOL 1.0",
  brand: "VW",
  model: "GOL",
  fipeName: null,
  modelYear: 2020,
  mileageKm: 50_000,
  category: "Carros",
  fuel: "Flex",
  vehicleOrigin: "financiamento" as const,
  hasKey: true,
  damageLevel: null,
  conditionFlags: [],
  inspectionResult: null,
  status: "open" as const,
  endsAt: new Date("2026-11-26T12:00:00Z"),
  currentBidCents: 2_000_000,
  minimumBidCents: 1_500_000,
  marketValueCents: 4_000_000,
};

describe("createAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    alertCreateManyMock.mockResolvedValue({ count: 1 });
  });

  it("usa o município configurado em user_preferences para calcular o raio de cada dono", async () => {
    watchFindManyMock.mockResolvedValue([
      { id: "w-bh", ownerId: "owner-bh", ...baseWatch },
      { id: "w-default", ownerId: "owner-default", ...baseWatch },
    ]);
    prefFindManyMock.mockResolvedValue([{ ownerId: "owner-bh", municipality: BH }]);
    listingFindManyMock.mockResolvedValue([
      { ...baseListing, id: "listing-bh", municipality: BH },
      { ...baseListing, id: "listing-sp", municipality: SAO_CARLOS },
    ]);
    alertCreateManyMock.mockResolvedValue({ count: 2 });

    const created = await createAlerts(NOW);

    expect(created).toBe(2);
    expect(alertCreateManyMock).toHaveBeenCalledWith({
      data: [
        { ownerId: "owner-bh", watchId: "w-bh", listingId: "listing-bh" },
        { ownerId: "owner-default", watchId: "w-default", listingId: "listing-sp" },
      ],
      skipDuplicates: true,
    });
  });
});
