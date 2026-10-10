import { describe, expect, it } from "vitest";

import { cents } from "@/domain/money";

import { salesByState, sortSales } from "./sales-sort";
import type { ResearchSale } from "./types";

const sale = (id: string, changes: Partial<ResearchSale>): ResearchSale => ({
  id,
  url: `https://example.com/${id}`,
  title: id,
  endsAt: new Date("2026-10-01T12:00:00Z"),
  state: "SP",
  city: null,
  modelYear: 2020,
  mileageKm: 50_000,
  damageLevel: null,
  finalBid: cents(3_000_000),
  marketValue: cents(6_000_000),
  marketValueOrigin: "source",
  ratio: 0.5,
  source: "Freitas",
  photoUrl: null,
  ...changes,
});

const ids = (sales: readonly ResearchSale[]) => sales.map((item) => item.id);

describe("sortSales", () => {
  const sales = [
    sale("a", { finalBid: cents(2_000_000), mileageKm: 80_000, ratio: 0.4 }),
    sale("b", { finalBid: cents(5_000_000), mileageKm: null, ratio: null }),
    sale("c", { finalBid: cents(3_000_000), mileageKm: 20_000, ratio: 0.6 }),
  ];

  it("ordena pelo lance, nos dois sentidos", () => {
    expect(ids(sortSales(sales, "bid", "desc"))).toEqual(["b", "c", "a"]);
    expect(ids(sortSales(sales, "bid", "asc"))).toEqual(["a", "c", "b"]);
  });

  it("venda sem o valor vai para o fim, também na ordem crescente", () => {
    expect(ids(sortSales(sales, "km", "asc"))).toEqual(["c", "a", "b"]);
    expect(ids(sortSales(sales, "km", "desc"))).toEqual(["a", "c", "b"]);
    expect(ids(sortSales(sales, "ratio", "asc"))).toEqual(["a", "c", "b"]);
  });

  it("empate mantém a ordem recebida", () => {
    const tied = [sale("x", {}), sale("y", {}), sale("z", {})];
    expect(ids(sortSales(tied, "year", "desc"))).toEqual(["x", "y", "z"]);
  });

  it("ordena pela data de encerramento", () => {
    const dated = [
      sale("old", { endsAt: new Date("2026-09-01T00:00:00Z") }),
      sale("new", { endsAt: new Date("2026-10-05T00:00:00Z") }),
    ];
    expect(ids(sortSales(dated, "date", "desc"))).toEqual(["new", "old"]);
  });

  it("não altera a lista recebida", () => {
    const before = ids(sales);
    sortSales(sales, "bid", "asc");
    expect(ids(sales)).toEqual(before);
  });
});

describe("salesByState", () => {
  it("conta por estado, do mais vendido ao menos, sem contar venda sem estado", () => {
    const sales = [sale("a", {}), sale("b", {}), sale("c", { state: "GO" }), sale("d", { state: null })];
    expect(salesByState(sales)).toEqual([
      { state: "SP", sales: 2 },
      { state: "GO", sales: 1 },
    ]);
  });
});
