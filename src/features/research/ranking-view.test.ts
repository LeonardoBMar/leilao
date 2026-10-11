import { describe, expect, it } from "vitest";

import { cents } from "@/domain/money";

import { type RankingModel, type RankingRow, rowsForAge, viewRanking } from "./ranking-view";

const row = (brand: string, model: string, median: number, n: number): RankingRow => ({
  brand,
  model,
  label: `${brand} ${model}`,
  n,
  low: median - 0.1,
  median,
  high: median + 0.1,
  year: 2015,
  bid: cents(2_000_000),
  perWeek: n / 10,
});

const rows = [
  row("FIAT", "UNO", 0.4, 30),
  row("CHEVROLET", "ONIX", 0.55, 90),
  row("HYUNDAI", "HB20", 0.4, 60),
  row("FIAT", "MOBI", 0.7, 12),
];

const labels = (list: readonly RankingRow[]) => list.map((item) => item.label);

describe("viewRanking", () => {
  it("menor mediana primeiro; empate pela amostra maior", () => {
    expect(labels(viewRanking(rows, "lowest", ""))).toEqual([
      "HYUNDAI HB20",
      "FIAT UNO",
      "CHEVROLET ONIX",
      "FIAT MOBI",
    ]);
  });

  it("maior mediana, mais vendas e nome", () => {
    expect(labels(viewRanking(rows, "highest", ""))[0]).toBe("FIAT MOBI");
    expect(labels(viewRanking(rows, "sales", ""))).toEqual(["CHEVROLET ONIX", "HYUNDAI HB20", "FIAT UNO", "FIAT MOBI"]);
    expect(labels(viewRanking(rows, "name", ""))).toEqual(["CHEVROLET ONIX", "FIAT MOBI", "FIAT UNO", "HYUNDAI HB20"]);
  });

  it("sem amostra pequena, os de 5 a 14 vendas saem", () => {
    expect(labels(viewRanking(rows, "lowest", "", { includeSmall: false }))).toEqual([
      "HYUNDAI HB20",
      "FIAT UNO",
      "CHEVROLET ONIX",
    ]);
  });

  it("filtra pela busca, com marca ou modelo", () => {
    expect(labels(viewRanking(rows, "lowest", "fiat"))).toEqual(["FIAT UNO", "FIAT MOBI"]);
    expect(labels(viewRanking(rows, "lowest", "hb"))).toEqual(["HYUNDAI HB20"]);
    expect(viewRanking(rows, "lowest", "gol")).toEqual([]);
  });
});

describe("rowsForAge", () => {
  const models: RankingModel<RankingRow>[] = [
    { ...row("FIAT", "UNO", 0.4, 30), byAge: { mais10: { ...row("FIAT", "UNO", 0.35, 20), year: 2009 } } },
    { ...row("CHEVROLET", "ONIX", 0.55, 90), byAge: {} },
  ];

  it("todas as idades devolve os modelos como estão", () => {
    expect(labels(rowsForAge(models, "all"))).toEqual(["FIAT UNO", "CHEVROLET ONIX"]);
  });

  it("uma faixa troca os números pelos dela e tira quem não tem amostra nela", () => {
    const [uno, ...rest] = rowsForAge(models, "mais10");
    expect(rest).toEqual([]);
    expect(uno).toMatchObject({ label: "FIAT UNO", n: 20, median: 0.35, year: 2009 });
  });
});
