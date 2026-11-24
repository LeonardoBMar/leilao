import { describe, expect, it } from "vitest";

import { cents } from "../money";
import { lotBidRiseRatio, lotBidSteps, lotBidTimeAxis } from "./bid-history";

const at = (iso: string) => new Date(iso);

describe("lotBidSteps", () => {
  it("ordena cronologicamente, ignora valores não positivos e deduplica lances consecutivos iguais", () => {
    const result = lotBidSteps([
      { observedAt: at("2026-11-20T14:00:00Z"), bid: cents(22_000_00) },
      { observedAt: at("2026-11-20T10:00:00Z"), bid: cents(20_000_00) },
      { observedAt: at("2026-11-20T12:00:00Z"), bid: cents(20_000_00) },
      { observedAt: at("2026-11-20T13:00:00Z"), bid: cents(0) },
      { observedAt: at("2026-11-20T16:00:00Z"), bid: cents(22_000_00) },
      { observedAt: at("2026-11-20T18:00:00Z"), bid: cents(25_000_00) },
    ]);

    expect(result).toEqual([
      { observedAt: at("2026-11-20T10:00:00Z"), bid: cents(20_000_00) },
      { observedAt: at("2026-11-20T14:00:00Z"), bid: cents(22_000_00) },
      { observedAt: at("2026-11-20T18:00:00Z"), bid: cents(25_000_00) },
    ]);
  });

  it("preserva recuo de lance seguido de volta ao valor anterior", () => {
    const result = lotBidSteps([
      { observedAt: at("2026-11-20T10:00:00Z"), bid: cents(20_000_00) },
      { observedAt: at("2026-11-20T11:00:00Z"), bid: cents(18_000_00) },
      { observedAt: at("2026-11-20T12:00:00Z"), bid: cents(20_000_00) },
    ]);
    expect(result).toHaveLength(3);
  });
});

describe("lotBidRiseRatio", () => {
  it("calcula a alta percentual do primeiro ao último degrau", () => {
    const steps = lotBidSteps([
      { observedAt: at("2026-11-20T10:00:00Z"), bid: cents(20_000_00) },
      { observedAt: at("2026-11-20T14:00:00Z"), bid: cents(25_000_00) },
    ]);
    expect(lotBidRiseRatio(steps)).toBeCloseTo(0.25);
  });

  it("retorna null quando há menos de dois degraus ou sem variação líquida", () => {
    expect(lotBidRiseRatio([{ observedAt: at("2026-11-20T10:00:00Z"), bid: cents(20_000_00) }])).toBeNull();
    expect(
      lotBidRiseRatio([
        { observedAt: at("2026-11-20T10:00:00Z"), bid: cents(20_000_00) },
        { observedAt: at("2026-11-20T11:00:00Z"), bid: cents(19_000_00) },
        { observedAt: at("2026-11-20T12:00:00Z"), bid: cents(20_000_00) },
      ]),
    ).toBeNull();
  });
});

describe("lotBidTimeAxis", () => {
  it("estende o fim do eixo até lastCheckedAt quando mais recente que o último lance", () => {
    const steps = [
      { observedAt: at("2026-11-20T10:00:00Z"), bid: cents(20_000_00) },
      { observedAt: at("2026-11-20T13:00:00Z"), bid: cents(22_000_00) },
    ];
    const lastChecked = at("2026-11-20T19:00:00Z");
    const axis = lotBidTimeAxis(steps, lastChecked, 4);

    expect(axis.xDomain).toEqual([at("2026-11-20T10:00:00Z").getTime(), lastChecked.getTime()]);
    expect(axis.tickTimes).toHaveLength(4);
    expect(axis.tickTimes[0]).toBe(axis.xDomain[0]);
    expect(axis.tickTimes.at(-1)).toBe(axis.xDomain[1]);
  });

  it("evita domínio de largura zero ou ticks duplicados quando observações são quase simultâneas", () => {
    const t = at("2026-11-20T10:00:00.000Z");
    const tPlus1Ms = at("2026-11-20T10:00:00.001Z");
    const axis = lotBidTimeAxis(
      [
        { observedAt: t, bid: cents(20_000_00) },
        { observedAt: tPlus1Ms, bid: cents(21_000_00) },
      ],
      tPlus1Ms,
      4,
    );
    expect(axis.xDomain[1]).toBeGreaterThan(axis.xDomain[0]);
    expect(new Set(axis.tickTimes).size).toBe(4);
  });
});
