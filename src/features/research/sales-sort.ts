import type { ResearchSale } from "./types";

export const SALE_SORT_KEYS = ["date", "bid", "ratio", "year", "km", "market"] as const;
export type SaleSortKey = (typeof SALE_SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";

const VALUE_OF = {
  date: (sale) => sale.endsAt.getTime(),
  bid: (sale) => sale.finalBid,
  ratio: (sale) => sale.ratio,
  year: (sale) => sale.modelYear,
  km: (sale) => sale.mileageKm,
  market: (sale) => sale.marketValue,
} as const satisfies Record<SaleSortKey, (sale: ResearchSale) => number | null>;

/**
 * Vendas ordenadas pela coluna escolhida. Quem não tem o valor (sem km, sem valor de mercado) vai sempre para o fim,
 * qualquer que seja o sentido, e o empate segue a ordem recebida (as mais recentes primeiro).
 */
export function sortSales(sales: readonly ResearchSale[], key: SaleSortKey, direction: SortDirection): ResearchSale[] {
  const valueOf = VALUE_OF[key];
  const sign = direction === "asc" ? 1 : -1;
  return sales.toSorted((a, b) => {
    const [x, y] = [valueOf(a), valueOf(b)];
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * sign;
  });
}

/** Estados que aparecem nas vendas, com a contagem de cada um, do que tem mais vendas ao que tem menos. */
export function salesByState(sales: readonly ResearchSale[]): { state: string; sales: number }[] {
  const counts = new Map<string, number>();
  for (const sale of sales) if (sale.state !== null) counts.set(sale.state, (counts.get(sale.state) ?? 0) + 1);
  return [...counts]
    .map(([state, n]) => ({ state, sales: n }))
    .toSorted((a, b) => b.sales - a.sales || a.state.localeCompare(b.state, "pt-BR"));
}
