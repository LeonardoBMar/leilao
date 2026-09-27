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

describe("datas de calendário (colunas date)", () => {
  it("convertem para meia-noite UTC e voltam iguais", async () => {
    const { calendarDateToUtc, monthToUtc, toCalendarDateInput, toMonthInput } = await import("./dates");
    const date = calendarDateToUtc("2026-10-02");
    expect(date?.toISOString()).toBe("2026-10-02T00:00:00.000Z");
    expect(date && toCalendarDateInput(date)).toBe("2026-10-02");
    expect(calendarDateToUtc("2026-02-30")).toBeNull();
    const month = monthToUtc("2026-10");
    expect(month?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(month && toMonthInput(month)).toBe("2026-10");
    expect(monthToUtc("2026-13")).toBeNull();
  });

  it("formatam sem voltar um dia no fuso de Brasília", async () => {
    const { formatCalendarDate, formatMonth, formatBps } = await import("./format");
    expect(formatCalendarDate(new Date("2026-10-02T00:00:00.000Z"))).toBe("02/10/2026");
    expect(formatMonth(new Date("2026-10-01T00:00:00.000Z"))).toBe("outubro de 2026");
    expect(formatBps(525)).toBe("5,25%");
    expect(formatBps(500)).toBe("5%");
  });
});
