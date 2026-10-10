import { describe, expect, it } from "vitest";

import { resolveEventAt } from "./event-time";

// 10/10/2026 15:00 em Brasília.
const now = new Date("2026-10-10T18:00:00.000Z");

describe("resolveEventAt", () => {
  it("usa o horário da referência que cai no dia escolhido", () => {
    const endsAt = new Date("2026-10-10T17:00:00.000Z");
    const otherDay = new Date("2026-10-08T13:00:00.000Z");
    expect(resolveEventAt("2026-10-10", [otherDay, endsAt], now)).toEqual(endsAt);
  });

  it("sem referência no dia, hoje vale agora", () => {
    expect(resolveEventAt("2026-10-10", [null], now)).toEqual(now);
  });

  it("sem referência no dia, dia passado vale o fim do dia", () => {
    expect(resolveEventAt("2026-10-08", [], now)?.toISOString()).toBe("2026-10-09T02:59:00.000Z");
  });

  it("ignora referência futura no mesmo dia", () => {
    const later = new Date("2026-10-10T22:00:00.000Z");
    expect(resolveEventAt("2026-10-10", [later], now)).toEqual(now);
  });

  it("dia futuro ou inválido não vale", () => {
    expect(resolveEventAt("2026-10-11", [], now)).toBeNull();
    expect(resolveEventAt("2026-02-31", [], now)).toBeNull();
  });
});
