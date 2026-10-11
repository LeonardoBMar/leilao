import { describe, expect, it } from "vitest";

import { cents } from "../money";
import { type BacktestSale, runBacktest, summarizeBacktest, summarizeBacktestBy } from "./backtest";
import { buildEstimateIndex, estimatePrice, type PriceEstimate } from "./estimates";

const DAY = 24 * 60 * 60 * 1000;
const day = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * DAY + 12 * 60 * 60 * 1000);

const sale = (id: string, endsAt: Date, finalBid: number, overrides: Partial<BacktestSale> = {}): BacktestSale => ({
  id,
  endsAt,
  fipeCode: null,
  origin: null,
  brand: "CHEVROLET",
  model: "ONIX",
  modelYear: 2020,
  mileageKm: null,
  category: "Carros",
  damageLevel: null,
  finalBid: cents(finalBid),
  marketValue: cents(6_000_000),
  ...overrides,
});

const fixed = (estimate: PriceEstimate) => (): (() => PriceEstimate) => () => estimate;

describe("runBacktest", () => {
  it("estima cada venda só com as vendas de dias anteriores, nunca com as do mesmo dia", () => {
    const sales = [sale("a", day(0), 100), sale("b", day(1), 100), sale("c", day(1), 100), sale("d", day(2), 100)];
    const seen: string[][] = [];
    runBacktest(
      sales,
      (prior) => {
        seen.push(prior.map((item) => item.id));
        return () => ({ kind: "insufficient", comparables: 0, needed: 5 });
      },
      { from: day(1), windowMs: 365 * DAY },
    );
    expect(seen).toEqual([["a"], ["a", "b", "c"]]);
  });

  it("deixa de fora as vendas mais antigas que a janela", () => {
    const sales = [sale("velha", day(0), 100), sale("nova", day(9), 100), sale("alvo", day(10), 100)];
    const seen: string[][] = [];
    runBacktest(
      sales,
      (prior) => {
        seen.push(prior.map((item) => item.id));
        return () => ({ kind: "insufficient", comparables: 0, needed: 5 });
      },
      { from: day(10), windowMs: 5 * DAY },
    );
    expect(seen).toEqual([["nova"]]);
  });

  it("roda com o preço provável de verdade: cinco vendas anteriores formam a faixa", () => {
    const prior = [2_000_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000].map((bid, index) =>
      sale(`p${index}`, day(index), bid),
    );
    const outcomes = runBacktest(
      [...prior, sale("alvo", day(10), 3_100_000)],
      (items) => {
        const index = buildEstimateIndex(items);
        return (target) => estimatePrice(target, index);
      },
      { from: day(10), windowMs: 365 * DAY },
    );
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.estimate).toMatchObject({ kind: "comparables", n: 5, median: 3_000_000 });
  });
});

describe("summarizeBacktest", () => {
  it("conta acertos dentro da faixa e o erro mediano só entre as vendas com estimativa", () => {
    const band = {
      kind: "comparables",
      level: "model",
      sameOrigin: false,
      confidence: "medium",
      saleIds: [],
      n: 5,
      median: cents(100),
      low: cents(90),
      high: cents(110),
    } as const;
    const outcomes = [
      { sale: sale("dentro", day(0), 100), estimate: band },
      { sale: sale("na borda", day(0), 110), estimate: band },
      { sale: sale("fora", day(0), 200), estimate: band },
      { sale: sale("sem", day(0), 100), estimate: { kind: "insufficient", comparables: 2, needed: 5 } as const },
    ];
    expect(summarizeBacktest(outcomes)).toEqual({
      total: 4,
      estimated: 3,
      hitRate: 2 / 3,
      // Erros 0, 10/110 e 100/200: a mediana é o do meio.
      medianAbsError: 10 / 110,
    });
  });

  it("sem nenhuma estimativa, taxa e erro ficam nulos", () => {
    expect(
      summarizeBacktest([
        { sale: sale("a", day(0), 100), estimate: { kind: "insufficient", comparables: 0, needed: 5 } },
      ]),
    ).toEqual({ total: 1, estimated: 0, hitRate: null, medianAbsError: null });
  });

  it("agrupa pelo critério dado", () => {
    const band = {
      kind: "comparables",
      level: "model",
      sameOrigin: false,
      confidence: "medium",
      saleIds: [],
      n: 5,
      median: cents(100),
      low: cents(90),
      high: cents(110),
    } as const;
    const outcomes = [
      { sale: sale("a", day(0), 100), estimate: band },
      { sale: sale("b", day(0), 100, { category: "Motos" }), estimate: band },
    ];
    const groups = summarizeBacktestBy(outcomes, ({ sale: item }) => item.category ?? "?");
    expect([...groups.keys()]).toEqual(["Carros", "Motos"]);
    expect(groups.get("Motos")?.total).toBe(1);
  });

  it("o estimador fixo de teste devolve sempre o mesmo resultado", () => {
    const estimate = { kind: "insufficient", comparables: 0, needed: 5 } as const;
    expect(runBacktest([sale("a", day(1), 1)], fixed(estimate), { from: day(0), windowMs: DAY })).toEqual([
      { sale: sale("a", day(1), 1), estimate },
    ]);
  });
});
