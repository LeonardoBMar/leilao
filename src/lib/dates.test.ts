import { describe, expect, it } from "vitest";

import { addDays, toZonedDateTimeInput, zonedDateTimeToUtc, zonedStartOfDay } from "./dates";

describe("zonedDateTimeToUtc", () => {
  it("interpreta o horário digitado como horário de Brasília (UTC−3)", () => {
    expect(zonedDateTimeToUtc("2026-10-02T10:00")?.toISOString()).toBe("2026-10-02T13:00:00.000Z");
    expect(zonedDateTimeToUtc("2026-12-31T23:30")?.toISOString()).toBe("2027-01-01T02:30:00.000Z");
  });

  it("respeita o horário de verão histórico (UTC−2 em 2018-12)", () => {
    expect(zonedDateTimeToUtc("2018-12-15T10:00")?.toISOString()).toBe("2018-12-15T12:00:00.000Z");
  });

  it.each(["", "2026-02-30T10:00", "2026-10-02", "2026-10-02T25:00", "02/10/2026 10:00"])("rejeita %s", (value) => {
    expect(zonedDateTimeToUtc(value)).toBeNull();
  });

  it("faz ida e volta com toZonedDateTimeInput", () => {
    const value = "2026-03-15T08:45";
    const utc = zonedDateTimeToUtc(value);
    expect(utc && toZonedDateTimeInput(utc)).toBe(value);
  });
});

describe("filtros por dia", () => {
  it("início do dia no fuso do app", () => {
    expect(zonedStartOfDay("2026-10-02")?.toISOString()).toBe("2026-10-02T03:00:00.000Z");
    expect(zonedStartOfDay("02/10/2026")).toBeNull();
  });

  it("soma dias atravessando meses e anos", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
