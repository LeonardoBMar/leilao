import type { ComparableLevel, SimilarityReason } from "@/domain/listings/estimates";
import { cents } from "@/domain/money";
import type { BandPosition, EvaluateLoosen } from "@/domain/research/evaluate";
import type { ResearchCategory, ResearchCondition, ResearchMetric } from "@/domain/research/filters";
import {
  type ExcludedSales,
  type GroupSummary,
  isSmallSample,
  MIN_SAMPLE,
  RATIO_BOUNDS,
} from "@/domain/research/summary";
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

/**
 * Por que vendas do filtro ficam fora do %: "15 sem valor de mercado · 3 com % fora de 1% a 200%". `null` sem
 * nenhuma de fora.
 */
export function excludedLabel({ noMarketValue, outOfBounds }: ExcludedSales): string | null {
  const parts = [
    noMarketValue > 0 ? `${noMarketValue.toLocaleString("pt-BR")} sem valor de mercado` : null,
    outOfBounds > 0
      ? `${outOfBounds.toLocaleString("pt-BR")} com % fora de ${formatRatio(RATIO_BOUNDS.min)} a ${formatRatio(RATIO_BOUNDS.max)}`
      : null,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

/** "100 mil km". */
export function mileageLabel(km: number): string {
  return `${(km / 1000).toLocaleString("pt-BR")} mil km`;
}

/** O `n` do grupo e, se a amostra é pequena, o aviso: "8 vendas · amostra pequena". */
export function smallSampleLabel(n: number): string {
  return isSmallSample(n) ? `${salesLabel(n)} · amostra pequena` : salesLabel(n);
}

/** Linha de apoio de um grupo: o `n`, ou quantas faltam para a mediana. */
export function summaryDetail(summary: GroupSummary): string {
  if (summary.kind === "summary") return smallSampleLabel(summary.n);
  if (summary.kind === "few") return `sem base (${summary.n} de ${MIN_SAMPLE})`;
  return "nenhuma venda";
}

/** Valor na medida do gráfico: "49%" ou "R$ 32,5 mil" (`value` em centavos). */
export function formatMetric(metric: ResearchMetric, value: number): string {
  return metric === "ratio" ? formatRatio(value) : formatCompactBRL(cents(Math.round(value)));
}

/**
 * Quanto o lance ainda sobe até o fim, dada a proporção lance visto ÷ lance final: 0,93 → "+8%". Com dado ruim do
 * coletor (lance visto acima do final) o sinal vira menos, em vez de "+-3%".
 */
export function riseLabel(ratioToFinal: number): string {
  const rise = 1 / ratioToFinal - 1;
  return `${rise < 0 ? "−" : "+"}${formatRatio(Math.abs(rise))}`;
}

/** A mediana dita como desconto: "51% abaixo do valor de mercado" (ou acima, se passar de 100%). */
export function belowMarketLabel(median: number): string {
  if (median >= 1) return `${formatRatio(median - 1)} acima do valor de mercado`;
  return `${formatRatio(1 - median)} abaixo do valor de mercado`;
}

/** De que grupo vêm as vendas do Avaliar (D-71, D-72). */
export const EVALUATE_LEVEL_LABELS = {
  version: "mesma versão FIPE",
  family: "mesma família",
  model: "mesmo modelo",
} as const satisfies Record<ComparableLevel, string>;

/** Por que uma venda é parecida com o lote alvo. */
export const SIMILARITY_LABELS = {
  same_version: "mesma versão",
  same_family: "mesma família",
  same_year: "mesmo ano",
  year_apart: "outro ano",
  same_origin: "mesma origem",
  close_mileage: "km próximo",
  same_condition: "mesma condição",
} as const satisfies Record<SimilarityReason, string>;

/** Lance atual de um lote aberto frente à faixa do recorte. */
export const BAND_POSITION_LABELS = {
  below: "Abaixo da faixa",
  inside: "Dentro da faixa",
  above: "Acima da faixa",
} as const satisfies Record<BandPosition, string>;

export const BAND_POSITION_VARIANTS = {
  below: "success",
  inside: "default",
  above: "warning",
} as const satisfies Record<BandPosition, "success" | "default" | "warning">;

const LOOSEN_LABELS = {
  years: "Ano ±1 a mais",
  km: "Qualquer km",
  origin: "Qualquer origem",
  version: "Todas as versões",
  family: "Todas as famílias",
} as const satisfies Record<EvaluateLoosen["change"], string>;

/** Botão que afrouxa um filtro: "Qualquer km (12 vendas)". */
export function loosenLabel({ change, n }: EvaluateLoosen): string {
  return `${LOOSEN_LABELS[change]} (${salesLabel(n)})`;
}
