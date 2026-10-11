import { describe, expect, it } from "vitest";

import { cents } from "../money";
import { saleBidsAxisHours, saleBidSteps } from "./sale-bids";

const endsAt = new Date("2026-10-08T18:00:00Z");
const at = (hoursBefore: number) => new Date(endsAt.getTime() - hoursBefore * 3_600_000);

describe("saleBidSteps", () => {
  it("um degrau por lance novo, em ordem, fechando no lance final", () => {
    expect(
      saleBidSteps(
        [
          { observedAt: at(6), bid: cents(30_000) },
          { observedAt: at(30), bid: cents(20_000) },
          { observedAt: at(12), bid: cents(20_000) },
        ],
        endsAt,
        cents(42_000),
      ),
    ).toEqual([
      { hoursBefore: -30, bid: cents(20_000) },
      { hoursBefore: -6, bid: cents(30_000) },
      { hoursBefore: 0, bid: cents(42_000) },
    ]);
  });

  it("fora da janela de 48 h, sem lance ou depois do fim não entra", () => {
    expect(
      saleBidSteps(
        [
          { observedAt: at(72), bid: cents(10_000) },
          { observedAt: at(2), bid: cents(0) },
          { observedAt: at(-1), bid: cents(50_000) },
        ],
        endsAt,
        cents(42_000),
      ),
    ).toEqual([{ hoursBefore: 0, bid: cents(42_000) }]);
  });

  it("lance final já visto antes do fim não se repete", () => {
    expect(saleBidSteps([{ observedAt: at(1), bid: cents(42_000) }], endsAt, cents(42_000))).toEqual([
      { hoursBefore: -1, bid: cents(42_000) },
    ]);
  });
});

describe("saleBidsAxisHours", () => {
  it("a menor janela que cobre o primeiro degrau", () => {
    expect(
      saleBidsAxisHours([
        { hoursBefore: -2.5, bid: cents(1) },
        { hoursBefore: 0, bid: cents(2) },
      ]),
    ).toBe(3);
    expect(
      saleBidsAxisHours([
        { hoursBefore: -13, bid: cents(1) },
        { hoursBefore: 0, bid: cents(2) },
      ]),
    ).toBe(24);
    expect(saleBidsAxisHours([{ hoursBefore: -47.9, bid: cents(1) }])).toBe(48);
    expect(saleBidsAxisHours([{ hoursBefore: 0, bid: cents(1) }])).toBe(3);
  });
});
