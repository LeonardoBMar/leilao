import { describe, expect, it } from "vitest";

import { cents, parseBRL, roundCents } from "./money";

describe("parseBRL", () => {
  it.each([
    ["1.234,56", 123456],
    ["R$ 1.234,56", 123456],
    ["1234", 123400],
    ["0,5", 50],
    ["-1,5", -150],
    ["12.000", 1200000],
  ])("converte %s em %i centavos", (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each(["", "abc", "1,234", "1,2,3"])("rejeita %s", (input) => {
    expect(parseBRL(input)).toBeNull();
  });
});

describe("roundCents", () => {
  it("arredonda meio centavo para longe de zero", () => {
    expect(roundCents(0.5)).toBe(1);
    expect(roundCents(-0.5)).toBe(-1);
    expect(roundCents(2.4)).toBe(2);
  });
});

describe("cents", () => {
  it("recusa valores fracionários", () => {
    expect(() => cents(1.5)).toThrow(RangeError);
  });
});
