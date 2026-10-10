import { cents } from "@/domain/money";
import type { ResearchCategory, ResearchCondition, ResearchMetric } from "@/domain/research/filters";
import { type GroupSummary, MIN_SAMPLE } from "@/domain/research/summary";
import { formatCompactBRL, formatRatio } from "@/lib/format";

export const CONDITION_LABELS = {
  "sem-monta": "Sem monta declarada",
  pequena: "Pequena monta",
  media: "Média monta",
  grande: "Grande monta",
  sucata: "Sucata",
} as const satisfies Record<ResearchCondition, string>;

export const CATEGORY_LABELS = {
  carros: "Carros",
  motos: "Motos",
  utilitarios: "Utilitários",
  sucatas: "Sucatas",
} as const satisfies Record<ResearchCategory, string>;

export const METRIC_LABELS = {
  ratio: "% do valor de mercado",
  price: "Lance final em R$",
} as const satisfies Record<ResearchMetric, string>;

/** "1 venda", "1.506 vendas". */
export function salesLabel(count: number): string {
  return `${count.toLocaleString("pt-BR")} ${count === 1 ? "venda" : "vendas"}`;
}

/** "2018 a 2020", "a partir de 2018", "até 2020"; `null` sem faixa de ano. */
export function yearRangeLabel({
  yearFrom,
  yearTo,
}: {
  yearFrom: number | null;
  yearTo: number | null;
}): string | null {
  if (yearFrom !== null && yearTo !== null) return yearFrom === yearTo ? String(yearFrom) : `${yearFrom} a ${yearTo}`;
  if (yearFrom !== null) return `a partir de ${yearFrom}`;
  if (yearTo !== null) return `até ${yearTo}`;
  return null;
}

/** Linha de apoio de um grupo: o `n`, ou quantas faltam para a mediana. */
export function summaryDetail(summary: GroupSummary): string {
  if (summary.kind === "summary") return salesLabel(summary.n);
  if (summary.kind === "few") return `sem base (${summary.n} de ${MIN_SAMPLE})`;
  return "nenhuma venda";
}

/** Valor na medida do gráfico: "49%" ou "R$ 32,5 mil" (`value` em centavos). */
export function formatMetric(metric: ResearchMetric, value: number): string {
  return metric === "ratio" ? formatRatio(value) : formatCompactBRL(cents(Math.round(value)));
}

/** A mediana dita como desconto: "51% abaixo do valor de mercado" (ou acima, se passar de 100%). */
export function belowMarketLabel(median: number): string {
  if (median >= 1) return `${formatRatio(median - 1)} acima do valor de mercado`;
  return `${formatRatio(1 - median)} abaixo do valor de mercado`;
}
