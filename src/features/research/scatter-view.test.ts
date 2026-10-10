import { describe, expect, it } from "vitest";

import { highlightOptions, isInHighlight, kmAxis, kmAxisLabel, type ScatterSale } from "./scatter-view";

const sale = (id: string, state: string | null, source: string): ScatterSale => ({
  id,
  url: `https://example.com/${id}`,
  label: id,
  year: 2020,
  km: 50_000,
  state,
  source,
  finalBid: 3_000_000,
});

describe("kmAxis", () => {
  it("vai do zero até a marca redonda que cobre o maior km, escrita em milhares", () => {
    const axis = kmAxis(87_000);
    expect(axis.domain).toEqual([0, 100_000]);
    expect(axis.ticks.map(({ label }) => label)).toEqual(["0", "50 mil", "100 mil"]);
  });

  it("sem km, o eixo ainda tem um domínio válido", () => {
    expect(kmAxis(0).domain).toEqual([0, 1]);
  });

  it("rótulo em milhares com separador brasileiro", () => {
    expect(kmAxisLabel(1_500)).toBe("1,5 mil");
  });
});

describe("highlightOptions", () => {
  const sales = [
    sale("a", "SP", "Freitas"),
    sale("b", "SP", "Superbid"),
    sale("c", "GO", "Freitas"),
    sale("d", null, "Freitas"),
  ];

  it("lista estados e fontes pelos que têm mais vendas, sem contar venda sem estado", () => {
    const { states, sources } = highlightOptions(sales);
    expect(states).toEqual([
      { value: "uf:SP", label: "São Paulo", sales: 2 },
      { value: "uf:GO", label: "Goiás", sales: 1 },
    ]);
    expect(sources.map(({ label, sales: n }) => [label, n])).toEqual([
      ["Freitas", 3],
      ["Superbid", 1],
    ]);
  });
});

describe("isInHighlight", () => {
  it("compara o estado ou a fonte; sem destaque, ninguém", () => {
    const item = sale("a", "SP", "Freitas");
    expect(isInHighlight(item, "uf:SP")).toBe(true);
    expect(isInHighlight(item, "uf:GO")).toBe(false);
    expect(isInHighlight(item, "fonte:Freitas")).toBe(true);
    expect(isInHighlight(item, "none")).toBe(false);
  });
});
