import { describe, expect, it } from "vitest";

import {
  ageBandOf,
  bidCurve,
  fillHistogram,
  type GroupStats,
  histogramBin,
  isRatioInBounds,
  isSmallSample,
  MIN_SAMPLE,
  rankModels,
  ratioAxisMax,
  remainingRise,
  summarize,
  unclassifiedLooksMixed,
  weeklyTrend,
  weeksBetween,
} from "./summary";

const stats = (n: number, median = 0.5): GroupStats => ({ n, p25: median - 0.05, median, p75: median + 0.05 });
const context = { medianYear: 2015, medianBid: 2_000_000 };
const model = (brand: string, name: string, groupStats: GroupStats) => ({
  brand,
  model: name,
  stats: groupStats,
  context,
  byAge: {},
});

describe("isSmallSample", () => {
  it.each([
    [MIN_SAMPLE - 1, false],
    [MIN_SAMPLE, true],
    [14, true],
    [15, false],
    [300, false],
  ])("%s vendas", (n, expected) => {
    expect(isSmallSample(n)).toBe(expected);
  });
});

describe("summarize", () => {
  it("com a amostra mínima, mostra mediana e faixa P25–P75", () => {
    expect(summarize(stats(MIN_SAMPLE, 0.49))).toEqual({
      kind: "summary",
      n: 5,
      low: 0.44,
      median: 0.49,
      high: 0.54,
    });
  });

  it.each([1, 4])("com %s venda(s), só a contagem, sem mediana", (n) => {
    expect(summarize(stats(n))).toEqual({ kind: "few", n });
  });

  it("sem vendas ou sem linha do banco, nada", () => {
    expect(summarize(stats(0))).toEqual({ kind: "none" });
    expect(summarize(null)).toEqual({ kind: "none" });
    expect(summarize(undefined)).toEqual({ kind: "none" });
  });
});

describe("rankModels", () => {
  it("só modelos com amostra mínima, da menor mediana para a maior", () => {
    const ranked = rankModels([
      model("FIAT", "STRADA", stats(7, 0.66)),
      model("PEUGEOT", "207", stats(5, 0.21)),
      model("FORD", "KA", stats(4, 0.1)),
      model("CHEVROLET", "ONIX", stats(43, 0.57)),
    ]);
    expect(ranked.map((item) => item.model)).toEqual(["207", "ONIX", "STRADA"]);
  });

  it("no empate, a amostra maior vem antes e, depois, o nome", () => {
    const ranked = rankModels([
      model("VOLKSWAGEN", "GOL", stats(8, 0.5)),
      model("FIAT", "UNO", stats(8, 0.5)),
      model("RENAULT", "SANDERO", stats(30, 0.5)),
    ]);
    expect(ranked.map((item) => item.model)).toEqual(["SANDERO", "UNO", "GOL"]);
  });
});

describe("unclassifiedLooksMixed", () => {
  it("avisa quando sem monta declarada e pequena monta quase empatam (49% × 50% em 08/10/2026)", () => {
    expect(
      unclassifiedLooksMixed({ "sem-monta": summarize(stats(737, 0.49)), pequena: summarize(stats(19, 0.5)) }),
    ).toBe(true);
  });

  it("não avisa com medianas distantes ou sem base em uma delas", () => {
    expect(
      unclassifiedLooksMixed({ "sem-monta": summarize(stats(737, 0.6)), pequena: summarize(stats(19, 0.45)) }),
    ).toBe(false);
    expect(unclassifiedLooksMixed({ "sem-monta": summarize(stats(737, 0.49)), pequena: summarize(stats(3)) })).toBe(
      false,
    );
    expect(unclassifiedLooksMixed({})).toBe(false);
  });
});

describe("histograma", () => {
  it("faixas de 2 em 2 pontos percentuais, como o floor(ratio / 0,02) da consulta", () => {
    expect(histogramBin(0)).toBe(0);
    expect(histogramBin(0.019)).toBe(0);
    expect(histogramBin(0.02)).toBe(1);
    // 0,06 / 0,02 dá 2,9999999999999996 em ponto flutuante.
    expect(histogramBin(0.06)).toBe(3);
    expect(histogramBin(0.49)).toBe(24);
  });

  it("o eixo vai até 100%, ou além se alguma venda passou do valor de mercado", () => {
    expect(ratioAxisMax(null)).toBe(1);
    expect(ratioAxisMax(0.78)).toBe(1);
    expect(ratioAxisMax(1.13)).toBe(1.2);
    expect(ratioAxisMax(5)).toBe(2);
  });

  it("preenche as faixas sem venda com zero", () => {
    const counts = fillHistogram(
      [
        { bin: 1, n: 3 },
        { bin: 24, n: 10 },
      ],
      1,
    );
    expect(counts).toHaveLength(50);
    expect(counts[0]).toBe(0);
    expect(counts[1]).toBe(3);
    expect(counts[24]).toBe(10);
  });

  it("venda além do fim do eixo soma na última faixa", () => {
    const counts = fillHistogram([{ bin: 50, n: 2 }], 1);
    expect(counts.at(-1)).toBe(2);
  });
});

describe("bidCurve", () => {
  it("só marcas com amostra mínima, de 48 h para 1 h", () => {
    const points = bidCurve([
      { hours: 1, stats: stats(466, 0.99) },
      { hours: 48, stats: stats(251, 0.9) },
      { hours: 24, stats: stats(4, 0.94) },
    ]);
    expect(points.map((point) => point.hours)).toEqual([48, 1]);
    expect(points[0]?.summary.median).toBe(0.9);
  });
});

describe("remainingRise", () => {
  const points = bidCurve([
    { hours: 48, stats: stats(200, 0.8) },
    { hours: 12, stats: stats(300, 0.9) },
    { hours: 1, stats: stats(400, 0.99) },
    { hours: 6, stats: stats(4, 0.95) },
  ]);

  it("usa a marca mais próxima do que falta", () => {
    expect(remainingRise(points, 13)).toEqual({ hours: 12, rise: 1 / 0.9 - 1, n: 300 });
    expect(remainingRise(points, 60)?.hours).toBe(48);
    expect(remainingRise(points, 0.4)?.hours).toBe(1);
    expect(remainingRise(points, 48)?.rise).toBeCloseTo(0.25);
  });

  it("sem amostra mínima na marca mais próxima, não diz nada", () => {
    expect(remainingRise(points, 6)).toBeNull();
    expect(remainingRise(points, 24)).toBeNull();
  });

  it("encerrado ou longe demais do fim, não diz nada", () => {
    expect(remainingRise(points, 0)).toBeNull();
    expect(remainingRise(points, 73)).toBeNull();
  });
});

describe("rankModels por idade", () => {
  it("cada faixa guarda o seu resumo, só com amostra mínima", () => {
    const [ranked] = rankModels([
      {
        ...model("FIAT", "UNO", stats(30, 0.4)),
        byAge: {
          ate5: { stats: stats(4, 0.8), context },
          "6a10": { stats: stats(10, 0.5), context: { medianYear: 2017, medianBid: 2_500_000 } },
          mais10: { stats: stats(16, 0.3), context },
        },
      },
    ]);
    expect(Object.keys(ranked?.byAge ?? {})).toEqual(["6a10", "mais10"]);
    expect(ranked?.byAge["6a10"]?.context.medianYear).toBe(2017);
  });
});

describe("ageBandOf", () => {
  it.each([
    [2021, 2026, "ate5"],
    [2016, 2026, "6a10"],
    [2015, 2026, "mais10"],
    [null, 2026, null],
  ] as const)("ano-modelo %s vendido em %s", (modelYear, saleYear, band) => {
    expect(ageBandOf(modelYear, saleYear)).toBe(band);
  });
});

describe("weeksBetween", () => {
  it("conta semanas, com o mínimo de uma", () => {
    expect(weeksBetween(new Date("2026-09-01T00:00:00Z"), new Date("2026-09-15T00:00:00Z"))).toBe(2);
    expect(weeksBetween(new Date("2026-09-01T00:00:00Z"), new Date("2026-09-02T00:00:00Z"))).toBe(1);
  });
});

describe("isRatioInBounds", () => {
  it("aceita de 1% a 200% do valor de mercado, inclusive", () => {
    expect(isRatioInBounds(0.01)).toBe(true);
    expect(isRatioInBounds(0.5)).toBe(true);
    expect(isRatioInBounds(2)).toBe(true);
    expect(isRatioInBounds(0.005)).toBe(false);
    expect(isRatioInBounds(2.5)).toBe(false);
  });
});

describe("weeklyTrend", () => {
  const week = (index: number, n: number) => ({ index, stats: stats(n) });

  it("só semanas com 50 vendas ou mais, e só com 8 delas", () => {
    const weeks = [week(0, 49), ...Array.from({ length: 8 }, (_, index) => week(index + 1, 50))];
    expect(weeklyTrend(weeks)?.map((item) => item.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(weeklyTrend(weeks.slice(0, 8))).toBeNull();
  });
});
