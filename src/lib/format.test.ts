import { describe, expect, it } from "vitest";

import { formatDayParts, formatShortDateTime, formatTime } from "./format";

describe("formatadores de agenda", () => {
  // 13:00 UTC = 10:00 em São Paulo.
  const auction = new Date("2030-10-02T13:00:00Z");

  it("separa o dia para agrupar leilões por data", () => {
    expect(formatDayParts(auction)).toEqual({ key: "2030-out-02", day: "02", month: "out 2030", weekday: "quarta" });
  });

  it("usa o fuso do app: 01:00 UTC ainda é o dia anterior em São Paulo", () => {
    expect(formatDayParts(new Date("2030-10-03T01:00:00Z")).day).toBe("02");
  });

  it("formata hora e data curta", () => {
    expect(formatTime(auction)).toBe("10:00");
    expect(formatShortDateTime(auction)).toBe("02 out 2030, 10:00");
  });
});
