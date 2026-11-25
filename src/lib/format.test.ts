import { describe, expect, it } from "vitest";

import { cents, parseBRL } from "@/domain/money";

import {
  formatCalendarDayMonth,
  formatClosingCountdown,
  formatCompactBRL,
  formatCompactDateTime,
  formatDayParts,
  formatDecimal,
  formatInteger,
  formatMoneyInput,
  formatShortDateTime,
  formatTime,
} from "./format";

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
    expect(formatCompactDateTime(auction)).toBe("02 out, 10:00");
  });
});

describe("formatCompactBRL", () => {
  it("abrevia milhares e milhões com uma casa", () => {
    // O Intl separa "R$" do número com espaço não separável.
    expect(formatCompactBRL(cents(3_254_000)).replace(/\s/g, " ")).toBe("R$ 32,5 mil");
    expect(formatCompactBRL(cents(85_000)).replace(/\s/g, " ")).toBe("R$ 850");
  });
});

describe("formatCalendarDayMonth", () => {
  it("dia e mês em UTC, sem voltar um dia", () => {
    expect(formatCalendarDayMonth(new Date("2026-10-05T00:00:00Z"))).toBe("05/10");
  });
});

describe("formatInteger e formatDecimal", () => {
  it("formata inteiros e decimais em pt-BR", () => {
    expect(formatInteger(12345)).toBe("12.345");
    expect(formatDecimal(7.5)).toBe("7,5");
    expect(formatDecimal(7)).toBe("7");
    expect(formatDecimal(1.25, 3)).toBe("1,25");
  });
});

describe("formatMoneyInput", () => {
  it("escreve o valor do campo sem milhar, e parseBRL lê de volta", () => {
    expect(formatMoneyInput(cents(123_450))).toBe("1234,50");
    expect(formatMoneyInput(cents(0))).toBe("0,00");
    expect(parseBRL(formatMoneyInput(cents(9_876_543)))).toBe(9_876_543);
  });
});

describe("formatClosingCountdown", () => {
  const endsAt = new Date("2030-10-02T13:00:00Z");

  it("destaca como urgente quando já encerrou ou faltam minutos", () => {
    expect(formatClosingCountdown(endsAt, new Date("2030-10-02T13:05:00Z"))).toEqual({
      label: "encerrando agora",
      isUrgent: true,
    });
    expect(formatClosingCountdown(endsAt, new Date("2030-10-02T12:15:00Z"))).toEqual({
      label: "encerra em 45 min",
      isUrgent: true,
    });
  });

  it("destaca em horas até 24h e usa data curta acima de 24h", () => {
    expect(formatClosingCountdown(endsAt, new Date("2030-10-02T10:00:00Z"))).toEqual({
      label: "encerra em 3h",
      isUrgent: true,
    });
    expect(formatClosingCountdown(endsAt, new Date("2030-09-30T13:00:00Z"))).toEqual({
      label: "encerra 02 out 2030, 10:00",
      isUrgent: false,
    });
  });
});
