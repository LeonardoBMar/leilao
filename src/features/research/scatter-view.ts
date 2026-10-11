import type { ContinuousAxis } from "@/components/charts/scatter-plot";
import { isStateCode, STATE_NAMES } from "@/domain/research/states";
import { niceTicks } from "@/lib/charts";

/** Venda como a dispersão a usa: tudo já serializável, para atravessar a fronteira servidor→cliente. */
export type ScatterSale = {
  id: string;
  url: string;
  /** Texto da venda, escrito sob o gráfico ao escolher o ponto. */
  label: string;
  year: number | null;
  km: number | null;
  state: string | null;
  source: string;
  /** Lance final em centavos. */
  finalBid: number;
  /** % do valor de mercado, só se entra nas estatísticas (`RATIO_BOUNDS`). */
  ratio: number | null;
};

export type ScatterXAxis = "year" | "km";
export type ScatterYAxis = "price" | "ratio";

/** Valor do destaque "nenhum". */
export const NO_HIGHLIGHT = "none";

/** "85 mil": o eixo do km em milhares (o rótulo completo vai na venda). */
export function kmAxisLabel(km: number): string {
  return km === 0 ? "0" : `${(km / 1000).toLocaleString("pt-BR")} mil`;
}

/** Eixo do km: do zero até a marca "redonda" que cobre o maior. */
export function kmAxis(maxKm: number): ContinuousAxis {
  const ticks = niceTicks(maxKm);
  const end = ticks.at(-1) ?? 1;
  return { domain: [0, end > 0 ? end : 1], ticks: ticks.map((value) => ({ value, label: kmAxisLabel(value) })) };
}

export type HighlightOption = { value: string; label: string; sales: number };

/**
 * Grupos que podem ser destacados: cada estado e cada fonte com venda no gráfico, os de mais vendas primeiro. Serve a
 * explicar por que dois pontos do mesmo ano estão tão longe, sem cor nova por categoria (DESIGN.md §3.1).
 */
export function highlightOptions(sales: readonly ScatterSale[]): {
  states: HighlightOption[];
  sources: HighlightOption[];
} {
  const count = (keyOf: (sale: ScatterSale) => string | null) => {
    const counts = new Map<string, number>();
    for (const sale of sales) {
      const key = keyOf(sale);
      if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts].toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  };
  return {
    states: count((sale) => sale.state).flatMap(([code, n]) =>
      isStateCode(code) ? [{ value: `uf:${code}`, label: STATE_NAMES[code], sales: n }] : [],
    ),
    sources: count((sale) => sale.source).map(([name, n]) => ({ value: `fonte:${name}`, label: name, sales: n })),
  };
}

/** A venda pertence ao grupo escolhido (`uf:SP`, `fonte:Freitas`)? */
export function isInHighlight(sale: ScatterSale, highlight: string): boolean {
  if (highlight.startsWith("uf:")) return sale.state === highlight.slice(3);
  if (highlight.startsWith("fonte:")) return sale.source === highlight.slice(6);
  return false;
}
