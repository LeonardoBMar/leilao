import { describe, expect, it } from "vitest";

import { type RankingRow, viewRanking } from "./ranking-view";

const row = (brand: string, model: string, median: number, n: number): RankingRow => ({
  brand,
  model,
  label: `${brand} ${model}`,
  n,
  low: median - 0.1,
  median,
  high: median + 0.1,
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
