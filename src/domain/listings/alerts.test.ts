import { describe, expect, it } from "vitest";

import { cents } from "../money";
import { ALERT_LOOKBACK_MS, type AlertCandidate, type AlertWatch, alertWindowStart, planAlerts } from "./alerts";
import { DEFAULT_CRITERIA } from "./criteria";

const now = new Date("2026-09-27T12:00:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

const watch = (overrides: Partial<AlertWatch> = {}): AlertWatch => ({
  id: "w1",
  ownerId: "u1",
  alertsFrom: hoursAgo(10),
  criteria: { ...DEFAULT_CRITERIA, search: "fox" },
  ...overrides,
});

const listing = (overrides: Partial<AlertCandidate> = {}): AlertCandidate => ({
  id: "l1",
  sourceId: "leilo",
  firstSeenAt: hoursAgo(1),
  title: "VW/FOX 1.0",
  brand: "VW",
  model: "FOX 1.0",
  fipeName: null,
  modelYear: 2012,
  mileageKm: null,
  category: "Carros",
  fuel: null,
  origin: "outros",
  hasKey: null,
  damageLevel: null,
  conditionFlags: [],
  inspection: null,
  status: "open",
  endsAt: new Date("2026-09-30T13:00:00Z"),
  currentBid: null,
  minimumBid: cents(1_500_000),
  marketValue: null,
  distanceKm: 40,
  ...overrides,
});

describe("planAlerts", () => {
  it("anúncio novo compatível gera um alerta para o dono do monitor", () => {
    expect(planAlerts([watch()], [listing()], now)).toEqual([{ ownerId: "u1", watchId: "w1", listingId: "l1" }]);
  });

  it("anúncio que já existia quando o monitor foi criado não gera alerta", () => {
    expect(planAlerts([watch()], [listing({ firstSeenAt: hoursAgo(11) })], now)).toEqual([]);
  });

  it("fora da janela de recuperação não gera alerta", () => {
    const old = new Date(now.getTime() - ALERT_LOOKBACK_MS - 1);
    expect(planAlerts([watch({ alertsFrom: hoursAgo(100) })], [listing({ firstSeenAt: old })], now)).toEqual([]);
  });

  it("incompatível ou já encerrado não gera alerta", () => {
    expect(planAlerts([watch()], [listing({ title: "FIAT/UNO", model: "UNO" })], now)).toEqual([]);
    expect(planAlerts([watch()], [listing({ distanceKm: 200 })], now)).toEqual([]);
    expect(planAlerts([watch()], [listing({ status: "sold" })], now)).toEqual([]);
  });

  it("cada monitor compatível recebe o seu alerta", () => {
    const other = watch({ id: "w2", ownerId: "u2" });
    expect(
      planAlerts([watch(), other], [listing(), listing({ id: "l2", title: "FIAT/UNO", model: "UNO" })], now),
    ).toEqual([
      { ownerId: "u1", watchId: "w1", listingId: "l1" },
      { ownerId: "u2", watchId: "w2", listingId: "l1" },
    ]);
  });
});

describe("alertWindowStart", () => {
  it("começa no monitor mais antigo, limitado à janela de recuperação", () => {
    expect(alertWindowStart([], now)).toBeNull();
    expect(alertWindowStart([{ alertsFrom: hoursAgo(5) }, { alertsFrom: hoursAgo(2) }], now)).toEqual(hoursAgo(5));
    expect(alertWindowStart([{ alertsFrom: hoursAgo(500) }], now)).toEqual(new Date(now.getTime() - ALERT_LOOKBACK_MS));
  });
});
