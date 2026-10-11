import type { ResearchVehicle } from "@/domain/research/filters";
import { isSmallSample } from "@/domain/research/summary";

import { matchModels } from "./search";

export const RANKING_SORTS = ["lowest", "highest", "sales", "name"] as const;
export type RankingSort = (typeof RANKING_SORTS)[number];

export const RANKING_SORT_LABELS = {
  lowest: "Menor mediana",
  highest: "Maior mediana",
  sales: "Mais vendas",
  name: "Nome",
} as const satisfies Record<RankingSort, string>;

/** Linha do ranking como a lista usa: só dados serializáveis. */
export type RankingRow = ResearchVehicle & { label: string; n: number; low: number; median: number; high: number };

const COMPARE = {
  lowest: (a, b) => a.median - b.median || b.n - a.n,
  highest: (a, b) => b.median - a.median || b.n - a.n,
  sales: (a, b) => b.n - a.n || a.median - b.median,
  name: () => 0,
} as const satisfies Record<RankingSort, (a: RankingRow, b: RankingRow) => number>;

/**
 * Modelos do ranking que casam com o texto (a mesma busca da barra de filtros), na ordem escolhida. Sem
 * `includeSmall`, os de amostra pequena saem: com poucas vendas, eles tomariam o topo da ordem por mediana. Empate
 * final pelo nome, para a ordem não pular entre renderizações.
 */
export function viewRanking<T extends RankingRow>(
  rows: readonly T[],
  sort: RankingSort,
  typed: string,
  { includeSmall = true }: { includeSmall?: boolean } = {},
): T[] {
  const pool = includeSmall ? rows : rows.filter((row) => !isSmallSample(row.n));
  return matchModels(pool, typed, pool.length).toSorted(
    (a, b) => COMPARE[sort](a, b) || a.label.localeCompare(b.label, "pt-BR"),
  );
}
