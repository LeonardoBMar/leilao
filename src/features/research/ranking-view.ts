import type { Cents } from "@/domain/money";
import type { ResearchVehicle } from "@/domain/research/filters";
import { AGE_BANDS, type AgeBand, isSmallSample } from "@/domain/research/summary";

import { matchModels } from "./search";

export const RANKING_SORTS = ["lowest", "highest", "sales", "name"] as const;
export type RankingSort = (typeof RANKING_SORTS)[number];

export const RANKING_SORT_LABELS = {
  lowest: "Menor mediana",
  highest: "Maior mediana",
  sales: "Mais vendas",
  name: "Nome",
} as const satisfies Record<RankingSort, string>;

export const RANKING_AGES = ["all", ...AGE_BANDS] as const;
export type RankingAge = (typeof RANKING_AGES)[number];

export const RANKING_AGE_LABELS = {
  all: "Qualquer idade",
  ate5: "Até 5 anos",
  "6a10": "6 a 10 anos",
  mais10: "Mais de 10 anos",
} as const satisfies Record<RankingAge, string>;

/**
 * Números de um grupo do ranking: o % da FIPE (mediana e faixa do meio), o ano-modelo e o lance final (centavos)
 * medianos e as vendas por semana no período do filtro.
 */
export type RankingStats = {
  n: number;
  low: number;
  median: number;
  high: number;
  year: number | null;
  bid: Cents;
  perWeek: number;
};

/** Linha do ranking como a lista usa: só dados serializáveis. */
export type RankingRow = ResearchVehicle & RankingStats & { label: string };

/** Modelo do ranking com os grupos por idade na venda; cada grupo pode trazer os seus próprios campos extras. */
export type RankingModel<T extends RankingRow> = T & { byAge: Partial<Record<AgeBand, RankingStats & Partial<T>>> };

/**
 * As linhas de uma idade: o grupo da faixa no lugar dos números de todas as idades; modelo sem a amostra mínima na
 * faixa sai da lista.
 */
export function rowsForAge<T extends RankingRow>(models: readonly RankingModel<T>[], age: RankingAge): T[] {
  return models.flatMap((model) => {
    if (age === "all") return [model];
    const group = model.byAge[age];
    return group === undefined ? [] : [{ ...model, ...group }];
  });
}

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
