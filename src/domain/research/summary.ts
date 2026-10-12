import { MIN_COMPARABLES } from "../listings/estimates";
import type { ResearchCondition, ResearchVehicle } from "./filters";

/**
 * Resumos da Pesquisa (docs/PLANO-PESQUISA.md §5, D-45). O banco agrega (contagem e percentis por grupo); aqui fica
 * o que a tela pode afirmar com aquela amostra. Puro.
 */

/** Abaixo disto o grupo não tem mediana nem cor: o mesmo mínimo do preço provável (D-36). */
export const MIN_SAMPLE = MIN_COMPARABLES;

/**
 * Com menos vendas que isto a mediana existe, mas balança: a tela marca "amostra pequena" (sem esconder o número). Fica
 * em 15, o triplo do mínimo: com 5 vendas a mediana muda bastante com uma venda a mais ou a menos.
 */
export const SMALL_SAMPLE = 15;

/** Amostra que tem mediana, mas é pequena (`MIN_SAMPLE` a `SMALL_SAMPLE - 1` vendas). */
export function isSmallSample(n: number): boolean {
  return n >= MIN_SAMPLE && n < SMALL_SAMPLE;
}

/**
 * Proporções lance final ÷ valor de mercado fora desta faixa indicam valor de mercado errado na fonte e ficam fora das
 * estatísticas. Em 08/10/2026 nenhuma venda caiu fora (P1 12%, P99 78%): é proteção contra erro futuro.
 */
export const RATIO_BOUNDS = { min: 0.01, max: 2 } as const;

/** A proporção entra nas estatísticas? Fora de `RATIO_BOUNDS`, a venda aparece na tabela marcada, mas não no %. */
export function isRatioInBounds(ratio: number): boolean {
  return ratio >= RATIO_BOUNDS.min && ratio <= RATIO_BOUNDS.max;
}

/**
 * Vendas do filtro que ficam fora dos gráficos em %: sem valor de mercado, ou com o % fora de `RATIO_BOUNDS` (valor de
 * mercado provavelmente errado na fonte).
 */
export type ExcludedSales = { noMarketValue: number; outOfBounds: number };

/** Histograma de 2 em 2 pontos percentuais: funciona com 20 ou 20 mil vendas. */
export const HISTOGRAM_STEP = 0.02;

/** Linha agregada pelo banco para um grupo (percentis com a interpolação do `percentile_cont`). */
export type GroupStats = { n: number; p25: number; median: number; p75: number };

/**
 * - `summary`: amostra suficiente, com mediana e faixa P25–P75.
 * - `few`: de 1 a 4 casos; a tela mostra a contagem e os casos um a um, sem mediana.
 * - `none`: nenhum caso.
 */
export type GroupSummary =
  | { kind: "summary"; n: number; low: number; median: number; high: number }
  | { kind: "few"; n: number }
  | { kind: "none" };

export function summarize(stats: GroupStats | null | undefined): GroupSummary {
  if (!stats || stats.n <= 0) return { kind: "none" };
  if (stats.n < MIN_SAMPLE) return { kind: "few", n: stats.n };
  return { kind: "summary", n: stats.n, low: stats.p25, median: stats.median, high: stats.p75 };
}

/** Mediana do resumo, quando ele tem uma. */
export function medianOf(summary: GroupSummary): number | null {
  return summary.kind === "summary" ? summary.median : null;
}

/** Idade do veículo na venda (ano da venda − ano-modelo), em faixas, para o ranking (docs/PLANO-MERCADO.md §6). */
export const AGE_BANDS = ["ate5", "6a10", "mais10"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** Maior idade de cada faixa, exceto a última; o SQL do ranking usa os mesmos limites. */
export const AGE_BAND_LIMITS = { ate5: 5, "6a10": 10 } as const;

/**
 * Distância em linha reta da região padrão (São Carlos/SP) até a cidade do pátio, em faixas, para o bloco "Onde"
 * (docs/PLANO-MERCADO.md §6). O frete e a viagem pesam no custo; a distância de estrada é maior.
 */
export const DISTANCE_BANDS = ["ate100", "ate300", "mais300"] as const;
export type DistanceBand = (typeof DISTANCE_BANDS)[number];

/** Maior distância (km) de cada faixa, exceto a última; o SQL usa os mesmos limites. */
export const DISTANCE_BAND_LIMITS = { ate100: 100, ate300: 300 } as const;

/** Contexto de um grupo do ranking: o ano-modelo e o lance final (centavos) medianos. */
export type RankingContext = { medianYear: number | null; medianBid: number };

type ModelGroup = { stats: GroupStats; context: RankingContext };
export type ModelStats = ResearchVehicle & ModelGroup & { byAge: Partial<Record<AgeBand, ModelGroup>> };

type RankedGroup = { summary: Extract<GroupSummary, { kind: "summary" }>; context: RankingContext };
export type RankedModel = ResearchVehicle & RankedGroup & { byAge: Partial<Record<AgeBand, RankedGroup>> };

function rankedGroup({ stats, context }: ModelGroup): RankedGroup | null {
  const summary = summarize(stats);
  return summary.kind === "summary" ? { summary, context } : null;
}

/**
 * Ranking dos modelos: só modelos com amostra mínima, da menor mediana para a maior; empate pela amostra maior (mais
 * confiável) e, depois, pelo nome. Cada faixa de idade guarda o seu resumo, também só com amostra mínima.
 */
export function rankModels(models: readonly ModelStats[]): RankedModel[] {
  return models
    .flatMap(({ brand, model, stats, context, byAge }) => {
      const all = rankedGroup({ stats, context });
      if (all === null) return [];
      const ages = AGE_BANDS.flatMap((band) => {
        const group = byAge[band];
        const ranked = group === undefined ? null : rankedGroup(group);
        return ranked === null ? [] : [[band, ranked] as const];
      });
      return [{ brand, model, ...all, byAge: Object.fromEntries(ages) }];
    })
    .toSorted(
      (a, b) =>
        a.summary.median - b.summary.median ||
        b.summary.n - a.summary.n ||
        `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`),
    );
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Semanas entre duas datas, no mínimo uma: a base de "vendas por semana". */
export function weeksBetween(from: Date, to: Date): number {
  return Math.max(1, (to.getTime() - from.getTime()) / WEEK_MS);
}

/** Distância entre medianas abaixo da qual "sem monta declarada" e pequena monta se confundem. */
const MIXED_CONDITION_GAP = 0.05;

/**
 * "Sem monta declarada" mistura veículos inteiros com avariados que a fonte não classificou. Quando a mediana dela
 * fica perto da de pequena monta (49% × 50% nos carros em 08/10/2026), a tela avisa.
 */
export function unclassifiedLooksMixed(
  byCondition: Readonly<Partial<Record<ResearchCondition, GroupSummary>>>,
): boolean {
  const unclassified = medianOf(byCondition["sem-monta"] ?? { kind: "none" });
  const small = medianOf(byCondition.pequena ?? { kind: "none" });
  return unclassified !== null && small !== null && Math.abs(unclassified - small) <= MIXED_CONDITION_GAP;
}

/** Fim do eixo do histograma: 100% do valor de mercado, ou mais se alguma venda passou dele, em décimos. */
export function ratioAxisMax(maxRatio: number | null): number {
  if (maxRatio === null || maxRatio <= 1) return 1;
  return Math.min(RATIO_BOUNDS.max, Math.ceil(maxRatio * 10) / 10);
}

/** Faixa do histograma de uma proporção (0 = de 0% a 2%). É a mesma conta da consulta: `floor(ratio / step)`. */
export function histogramBin(ratio: number): number {
  return Math.floor(ratio / HISTOGRAM_STEP + 1e-9);
}

/**
 * Contagens por faixa vindas do banco (só as faixas com venda) em lista densa de 0 até o fim do eixo, para desenhar
 * o histograma sem buracos. Faixas além do eixo somam na última.
 */
export function fillHistogram(bins: readonly { bin: number; n: number }[], axisMax: number): number[] {
  const length = histogramBin(axisMax);
  const counts = Array.from({ length }, () => 0);
  for (const { bin, n } of bins) {
    const index = Math.min(Math.max(bin, 0), length - 1);
    counts[index] = (counts[index] ?? 0) + n;
  }
  return counts;
}

/**
 * Marcas da curva do lance, em horas antes do fim. A de 72 h fica de fora até haver base (17 vendas em 08/10/2026,
 * contra 251 em 48 h).
 */
export const BID_CURVE_HOURS = [48, 24, 12, 6, 3, 1] as const;
export type BidCurveHour = (typeof BID_CURVE_HOURS)[number];
/** Só a última observação nesta janela antes de cada marca conta: lance de três dias antes não representa a marca. */
export const BID_CURVE_LOOKBACK_HOURS = 24;

export type BidCurvePoint = { hours: BidCurveHour; summary: Extract<GroupSummary, { kind: "summary" }> };

/** Pontos da curva com amostra mínima, da marca mais distante do fim para a mais próxima. */
export function bidCurve(marks: readonly { hours: BidCurveHour; stats: GroupStats }[]): BidCurvePoint[] {
  return BID_CURVE_HOURS.flatMap((hours) => {
    const summary = summarize(marks.find((mark) => mark.hours === hours)?.stats);
    return summary.kind === "summary" ? [{ hours, summary }] : [];
  });
}

/** Além disto do fim, nenhuma marca da curva representa o lote (48 h + a janela de 24 h da observação). */
const BID_CURVE_HORIZON_HOURS = BID_CURVE_HOURS[0] + BID_CURVE_LOOKBACK_HOURS;

/**
 * Quanto o lance ainda costuma subir até o fim (docs/PLANO-MERCADO.md T3.6): na marca de horas mais próxima do que
 * falta, o lance final dividido pelo lance da marca, menos 1, na mediana. A marca precisa ter amostra mínima (a curva
 * só traz essas); sem ela, ou com o lote encerrado ou longe demais do fim, `null`.
 */
export function remainingRise(
  points: readonly BidCurvePoint[],
  hoursLeft: number,
): { hours: BidCurveHour; rise: number; n: number } | null {
  if (hoursLeft <= 0 || hoursLeft > BID_CURVE_HORIZON_HOURS) return null;
  const nearest = BID_CURVE_HOURS.reduce((best, hours) =>
    Math.abs(hours - hoursLeft) < Math.abs(best - hoursLeft) ? hours : best,
  );
  const point = points.find((candidate) => candidate.hours === nearest);
  if (point === undefined || point.summary.median <= 0) return null;
  return { hours: nearest, rise: 1 / point.summary.median - 1, n: point.summary.n };
}

/** Semanas com base que a tendência exige antes de aparecer (D-75). */
export const TREND_MIN_WEEKS = 8;
/** Vendas mínimas de uma semana para ela entrar na tendência (D-75): abaixo disso, a mediana semanal oscila à toa. */
export const TREND_MIN_WEEKLY_SALES = 50;

/**
 * Tendência semanal (D-75): só as semanas com `TREND_MIN_WEEKLY_SALES` vendas ou mais, na ordem; com menos de
 * `TREND_MIN_WEEKS` delas, `null` (a tela não mostra tendência).
 */
export function weeklyTrend<T extends { stats: GroupStats }>(weeks: readonly T[]): T[] | null {
  const based = weeks.filter((week) => week.stats.n >= TREND_MIN_WEEKLY_SALES);
  return based.length >= TREND_MIN_WEEKS ? based : null;
}
