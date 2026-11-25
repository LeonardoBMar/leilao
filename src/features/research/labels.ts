import { categoryKeyOf } from "@/domain/listings/criteria";
import type { ComparableLevel, EstimateConfidence, SimilarityReason } from "@/domain/listings/estimates";
import { cents } from "@/domain/money";
import type { BandPlacement, CalibrationSummary } from "@/domain/research/calibration";
import { type BandPosition, type EvaluateFilters, type EvaluateLoosen, familyLabel } from "@/domain/research/evaluate";
import {
  type ResearchCategory,
  type ResearchCondition,
  type ResearchMetric,
  type ResearchPeriod,
  vehicleLabel,
} from "@/domain/research/filters";
import {
  type ExcludedSales,
  type GroupSummary,
  isSmallSample,
  MIN_SAMPLE,
  RATIO_BOUNDS,
} from "@/domain/research/summary";
import { formatCompactBRL, formatDecimal, formatInteger, formatRatio } from "@/lib/format";
import { CATEGORY_LABELS as LISTING_CATEGORY_LABELS, ORIGIN_LABELS } from "@/lib/listing-filter-labels";

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
  ratio: "% da FIPE",
  price: "Lance final em R$",
} as const satisfies Record<ResearchMetric, string>;

/** "Últimos 30 dias". */
export function periodLabel(period: ResearchPeriod): string {
  return `Últimos ${period} dias`;
}

/** "1 venda", "1.506 vendas". */
export function salesLabel(count: number): string {
  return `${formatInteger(count)} ${count === 1 ? "venda" : "vendas"}`;
}

/** Liquidez: "3,5 por semana"; abaixo de uma, "menos de 1 por semana". */
export function perWeekLabel(value: number): string {
  return value < 1 ? "menos de 1 por semana" : `${formatDecimal(value)} por semana`;
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
    noMarketValue > 0 ? `${formatInteger(noMarketValue)} sem FIPE` : null,
    outOfBounds > 0
      ? `${formatInteger(outOfBounds)} com % fora de ${formatRatio(RATIO_BOUNDS.min)} a ${formatRatio(RATIO_BOUNDS.max)}`
      : null,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

/** "100 mil km". */
export function mileageLabel(km: number): string {
  return `${formatDecimal(km / 1000, 3)} mil km`;
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

/** A mediana dita como desconto: "51% abaixo da FIPE" (ou acima, se passar de 100%). */
export function belowMarketLabel(median: number): string {
  if (median >= 1) return `${formatRatio(median - 1)} acima da FIPE`;
  return `${formatRatio(1 - median)} abaixo da FIPE`;
}

/** De que grupo vêm as vendas do Avaliar (D-71, D-72). */
export const EVALUATE_LEVEL_LABELS = {
  version: "da mesma versão FIPE",
  family: "da mesma família",
  model: "do mesmo modelo",
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

/**
 * Destaque visual do lance atual frente à faixa: abaixo/dentro ficam neutros (o lance ainda sobe até o fim; DESIGN.md
 * §3.1 — no Mercado, mais barato não é "bom"); só "Acima da faixa" pede atenção em `warning`.
 */
export const BAND_POSITION_VARIANTS = {
  below: "outline",
  inside: "default",
  above: "warning",
} as const satisfies Record<BandPosition, "outline" | "default" | "warning">;

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

/** Confiança da faixa (D-72), sozinha num rótulo "Confiança: alta". */
export const CONFIDENCE_SHORT_LABELS = {
  high: "alta",
  medium: "média",
  low: "baixa",
} as const satisfies Record<EstimateConfidence, string>;

/** O recorte em palavras: "Chevrolet Onix · família ONIX PLUS · 2022 a 2024 · Sem monta declarada". */
export function evaluateScopeLabel(filters: EvaluateFilters, versionLabels: Readonly<Record<string, string>>): string {
  return [
    filters.vehicle === null ? null : vehicleLabel(filters.vehicle),
    filters.version === null ? null : `versão ${versionLabels[filters.version] ?? filters.version}`,
    filters.version !== null || filters.family === null ? null : `família ${familyLabel(filters.family)}`,
    yearRangeLabel(filters),
    filters.maxKm === null ? null : `até ${mileageLabel(filters.maxKm)}`,
    CONDITION_LABELS[filters.condition],
    filters.origin === null ? null : ORIGIN_LABELS[filters.origin],
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/** "12% abaixo do arremate", "5% acima do arremate" ou "igual ao arremate" (desvio em fração do arremate). */
export function deviationLabel(deviation: number): string {
  const percent = Math.round(Math.abs(deviation) * 100);
  if (percent === 0) return "igual ao arremate";
  return `${percent}% ${deviation < 0 ? "abaixo" : "acima"} do arremate`;
}

/** "Em 26 resultados, o arremate caiu dentro da faixa típica 11 vezes (42%)."; `null` sem nenhum com faixa. */
export function bandHitSentence({ band }: CalibrationSummary): string | null {
  if (band.rate === null) return null;
  const times = band.inside === 1 ? "1 vez" : `${band.inside} vezes`;
  return `Em ${band.n} ${band.n === 1 ? "resultado" : "resultados"}, o arremate caiu dentro da faixa típica ${times} (${formatRatio(band.rate)}).`;
}

/** "Seu limite ficou, na mediana, 12% abaixo do arremate."; `null` sem limite viável. */
export function limitSentence({ limit }: CalibrationSummary): string | null {
  if (limit.medianDeviation === null) return null;
  return `Seu limite ficou, na mediana, ${deviationLabel(limit.medianDeviation)}.`;
}

export const BAND_PLACEMENT_LABELS = {
  below: "Abaixo da faixa",
  inside: "Dentro da faixa",
  above: "Acima da faixa",
} as const satisfies Record<BandPlacement, string>;

/** Categoria do anúncio ligado ao lote; sem anúncio, "Sem anúncio". */
export function listingCategoryLabel(category: string | null): string {
  return category === null ? "Sem anúncio" : LISTING_CATEGORY_LABELS[categoryKeyOf(category)];
}
