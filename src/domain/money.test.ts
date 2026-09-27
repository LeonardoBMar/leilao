import { describe, expect, it } from "vitest";

import { applyRate, bps, cents, parseBRL, parsePercent, roundCents, sumCents } from "./money";

describe("parsePercent", () => {
  it.each([
    ["5", 500],
    ["5,25", 525],
    ["5,25%", 525],
    ["0", 0],
    ["100", 10_000],
  ])("converte %s em %i pontos-base", (input, expected) => {
    expect(parsePercent(input)).toBe(expected);
  });

  it.each(["", "-1", "100,01", "5,255", "abc"])("rejeita %s", (input) => {
    expect(parsePercent(input)).toBeNull();
  });
});

describe("applyRate", () => {
  it("arredonda meio centavo para cima com aritmética inteira", () => {
    expect(applyRate(cents(10), bps(500))).toBe(1);
    expect(applyRate(cents(3_352_381), bps(500))).toBe(167_619);
    expect(applyRate(cents(2_147_483_647), bps(10_000))).toBe(2_147_483_647);
  });

  it("recusa valor negativo e taxa fora da faixa", () => {
    expect(() => applyRate(cents(-1), bps(500))).toThrow(RangeError);
    expect(() => bps(10_001)).toThrow(RangeError);
    expect(() => bps(1.5)).toThrow(RangeError);
  });
});

describe("sumCents", () => {
  it("soma valores em centavos", () => {
    expect(sumCents([cents(1), cents(2), cents(3)])).toBe(6);
    expect(sumCents([])).toBe(0);
  });
});

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
