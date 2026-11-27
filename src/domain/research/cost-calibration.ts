import { DEFAULT_COSTS, SALE_DISCOUNT_BPS, type UserDefaultOverrides } from "@/domain/finance/defaults";
import { type Bps, bps, type Cents, cents } from "@/domain/money";
import type { ExpenseCategory } from "@/domain/post-auction/pnl";

/**
 * Calibração 2.0 (D-97): cruza lotes vendidos no pós-arremate com suas análises fixadas pré-leilão
 * (`analysisTiming = "prior"`) para medir o viés real de custos por categoria e de preço de revenda,
 * e propor ajustes explícitos nas preferências do usuário.
 */

/** Amostra mínima para sugerir ajustes nas preferências com confiança básica. */
export const MIN_COST_CALIBRATION_LOTS = 3;

export const CALIBRATION_COST_CATEGORIES = [
  "repair",
  "documentation",
  "transport",
  "tires",
  "service",
  "auction_fees",
  "debts",
  "selling",
  "tax",
] as const satisfies readonly ExpenseCategory[];

export type CalibrationCostCategory = (typeof CALIBRATION_COST_CATEGORIES)[number];

export type CostCalibrationLotInput = {
  lotId: string;
  label: string;
  soldAt: Date | null;
  expectedSalePrice: Cents;
  actualSalePrice: Cents;
  plannedTotalWithoutReserve: Cents;
  actualTotalInvested: Cents;
  expectedProfitAtBid: Cents;
  realizedProfit: Cents;
  holdDays: number | null;
  plannedByCategory: Record<ExpenseCategory, Cents>;
  actualByCategory: Record<ExpenseCategory, Cents>;
};

export type CategoryCostBias = {
  category: CalibrationCostCategory;
  /** Lotes com gasto previsto ou real > 0 nesta categoria. */
  sampleCount: number;
  /** Lotes com previsto > 0 (base para viés percentual). */
  ratioSampleCount: number;
  medianPlanned: Cents;
  medianActual: Cents;
  /** Mediana de `(actual − planned)` em centavos. Positivo = gastou mais que o previsto. */
  medianDelta: Cents;
  /** Mediana de `(actual − planned) / planned` quando `ratioSampleCount > 0`. */
  medianBiasRatio: number | null;
};

export type SalePriceBias = {
  n: number;
  medianExpected: Cents | null;
  medianActual: Cents | null;
  /** Mediana de `(actualSale − expectedSale) / expectedSale`. Negativo = vendeu abaixo do esperado. */
  medianBiasRatio: number | null;
};

export type CalibrationPreferencePatch = {
  documentationCost?: Cents;
  riskReserveRateBps?: Bps;
  saleDiscountNoneBps?: Bps;
  saleDiscountSmallBps?: Bps;
  saleDiscountMediumBps?: Bps;
  saleDiscountLargeBps?: Bps;
};

export type PreferenceCalibrationSuggestion = {
  id: "documentation" | "risk_reserve" | "sale_discounts";
  title: string;
  rationale: string;
  patch: CalibrationPreferencePatch;
};

export type CostCalibrationSummary = {
  n: number;
  hasMinimumSample: boolean;
  salePriceBias: SalePriceBias;
  /** Mediana de `(actualTotalInvested − plannedTotalWithoutReserve) / plannedTotalWithoutReserve`. */
  medianCostVarianceRatio: number | null;
  medianHoldDays: number | null;
  totalExpectedProfit: Cents;
  totalRealizedProfit: Cents;
  byCategory: CategoryCostBias[];
  suggestions: PreferenceCalibrationSuggestion[];
};

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Calcula vieses de custo/revenda e sugestões de ajuste nas preferências do usuário. */
export function summarizeCostCalibration(
  lots: readonly CostCalibrationLotInput[],
  currentOverrides?: UserDefaultOverrides | null,
): CostCalibrationSummary {
  const n = lots.length;
  const hasMinimumSample = n >= MIN_COST_CALIBRATION_LOTS;

  const saleExpected: number[] = [];
  const saleActual: number[] = [];
  const saleRatios: number[] = [];
  const totalCostRatios: number[] = [];
  const holdDaysList: number[] = [];
  let totalExpectedProfit = 0;
  let totalRealizedProfit = 0;

  for (const lot of lots) {
    totalExpectedProfit += lot.expectedProfitAtBid;
    totalRealizedProfit += lot.realizedProfit;
    if (lot.holdDays !== null) holdDaysList.push(lot.holdDays);
    if (lot.expectedSalePrice > 0 && lot.actualSalePrice > 0) {
      saleExpected.push(lot.expectedSalePrice);
      saleActual.push(lot.actualSalePrice);
      saleRatios.push((lot.actualSalePrice - lot.expectedSalePrice) / lot.expectedSalePrice);
    }
    if (lot.plannedTotalWithoutReserve > 0) {
      totalCostRatios.push((lot.actualTotalInvested - lot.plannedTotalWithoutReserve) / lot.plannedTotalWithoutReserve);
    }
  }

  const byCategory: CategoryCostBias[] = [];
  for (const category of CALIBRATION_COST_CATEGORIES) {
    const plannedValues: number[] = [];
    const actualValues: number[] = [];
    const deltas: number[] = [];
    const ratios: number[] = [];

    for (const lot of lots) {
      const planned = lot.plannedByCategory[category];
      const actual = lot.actualByCategory[category];
      if (planned === 0 && actual === 0) continue;
      plannedValues.push(planned);
      actualValues.push(actual);
      deltas.push(actual - planned);
      if (planned > 0) ratios.push((actual - planned) / planned);
    }

    if (plannedValues.length === 0) continue;
    byCategory.push({
      category,
      sampleCount: plannedValues.length,
      ratioSampleCount: ratios.length,
      medianPlanned: cents(Math.round(median(plannedValues) ?? 0)),
      medianActual: cents(Math.round(median(actualValues) ?? 0)),
      medianDelta: cents(Math.round(median(deltas) ?? 0)),
      medianBiasRatio: median(ratios),
    });
  }

  const salePriceBias: SalePriceBias = {
    n: saleRatios.length,
    medianExpected: saleExpected.length > 0 ? cents(Math.round(median(saleExpected) ?? 0)) : null,
    medianActual: saleActual.length > 0 ? cents(Math.round(median(saleActual) ?? 0)) : null,
    medianBiasRatio: median(saleRatios),
  };

  const medianCostVarianceRatio = median(totalCostRatios);
  const medianHold = median(holdDaysList);
  const medianHoldDays = medianHold === null ? null : Math.round(medianHold);

  const suggestions = buildSuggestions({
    hasMinimumSample,
    byCategory,
    salePriceBias,
    medianCostVarianceRatio,
    currentOverrides,
  });

  return {
    n,
    hasMinimumSample,
    salePriceBias,
    medianCostVarianceRatio,
    medianHoldDays,
    totalExpectedProfit: cents(totalExpectedProfit),
    totalRealizedProfit: cents(totalRealizedProfit),
    byCategory,
    suggestions,
  };
}

function buildSuggestions(params: {
  hasMinimumSample: boolean;
  byCategory: readonly CategoryCostBias[];
  salePriceBias: SalePriceBias;
  medianCostVarianceRatio: number | null;
  currentOverrides?: UserDefaultOverrides | null;
}): PreferenceCalibrationSuggestion[] {
  if (!params.hasMinimumSample) return [];
  const suggestions: PreferenceCalibrationSuggestion[] = [];

  // 1. Documentação: quando há amostra suficiente e desvio mediano ≥ R$ 100 em relação ao padrão atual.
  const docBias = params.byCategory.find((item) => item.category === "documentation");
  if (docBias && docBias.sampleCount >= MIN_COST_CALIBRATION_LOTS) {
    const currentDoc = params.currentOverrides?.documentationCost ?? DEFAULT_COSTS.documentation;
    const suggestedDoc = cents(clamp(roundToStep(docBias.medianActual, 5_000), 0, 2_000_000));
    if (Math.abs(suggestedDoc - currentDoc) >= 10_000) {
      suggestions.push({
        id: "documentation",
        title: "Ajustar documentação padrão",
        rationale: `Sua mediana real de documentação em ${docBias.sampleCount} vendas foi diferente do padrão atual.`,
        patch: { documentationCost: suggestedDoc },
      });
    }
  }

  // 2. Reserva de risco: se o custo total realizado excede sistematicamente o previsto em ≥ 3%.
  // Nota: `medianCostVarianceRatio` mede o estouro sobre o custo previsto (que inclui o lance); como o custo
  // previsto é menor que o valor de venda, a sugestão sobre `riskReserveRateBps` é ligeiramente conservadora.
  if (params.medianCostVarianceRatio !== null && params.medianCostVarianceRatio >= 0.03) {
    const currentReserve = params.currentOverrides?.riskReserveRateBps ?? DEFAULT_COSTS.riskReserveRate;
    const suggestedBps = bps(clamp(roundToStep(Math.round(params.medianCostVarianceRatio * 10_000), 50), 100, 5_000));
    if (suggestedBps >= currentReserve + 100) {
      suggestions.push({
        id: "risk_reserve",
        title: "Reforçar reserva de risco",
        rationale: "Seus custos reais totais ficaram consistentemente acima do previsto nas vendas encerradas.",
        patch: { riskReserveRateBps: suggestedBps },
      });
    }
  }

  // 3. Desconto sobre a FIPE na venda: se o preço real de revenda difere ≥ 2% do valor esperado.
  // Ancorado ao baseline padrão (`SALE_DISCOUNT_BPS`) para garantir idempotência após aplicar a calibração.
  if (
    params.salePriceBias.n >= MIN_COST_CALIBRATION_LOTS &&
    params.salePriceBias.medianBiasRatio !== null &&
    Math.abs(params.salePriceBias.medianBiasRatio) >= 0.02
  ) {
    // Venda abaixo do esperado (bias negativo) → aumenta o desconto sobre a FIPE; acima → reduz o desconto.
    const deltaBps = roundToStep(Math.round(-params.salePriceBias.medianBiasRatio * 10_000), 50);
    if (deltaBps !== 0) {
      const targetNone = bps(clamp(SALE_DISCOUNT_BPS.none + deltaBps, 0, 8_000));
      const targetSmall = bps(clamp(SALE_DISCOUNT_BPS.small + deltaBps, 0, 8_000));
      const targetMedium = bps(clamp(SALE_DISCOUNT_BPS.medium + deltaBps, 0, 8_000));
      const targetLarge = bps(clamp(SALE_DISCOUNT_BPS.large + deltaBps, 0, 8_000));

      const currentNone = params.currentOverrides?.saleDiscountNoneBps ?? SALE_DISCOUNT_BPS.none;
      const currentSmall = params.currentOverrides?.saleDiscountSmallBps ?? SALE_DISCOUNT_BPS.small;
      const currentMedium = params.currentOverrides?.saleDiscountMediumBps ?? SALE_DISCOUNT_BPS.medium;
      const currentLarge = params.currentOverrides?.saleDiscountLargeBps ?? SALE_DISCOUNT_BPS.large;

      const hasMeaningfulChange =
        Math.abs(targetNone - currentNone) >= 50 ||
        Math.abs(targetSmall - currentSmall) >= 50 ||
        Math.abs(targetMedium - currentMedium) >= 50 ||
        Math.abs(targetLarge - currentLarge) >= 50;

      if (hasMeaningfulChange) {
        suggestions.push({
          id: "sale_discounts",
          title: "Calibrar desconto de revenda sobre a FIPE",
          rationale:
            deltaBps > 0
              ? "Suas vendas reais saíram abaixo do valor projetado; aumentar o desconto protege o lance máximo."
              : "Suas vendas reais superaram o valor projetado; reduzir o desconto evita perder lances viáveis.",
          patch: {
            saleDiscountNoneBps: targetNone,
            saleDiscountSmallBps: targetSmall,
            saleDiscountMediumBps: targetMedium,
            saleDiscountLargeBps: targetLarge,
          },
        });
      }
    }
  }

  return suggestions;
}

/** Mescla todos os patches sugeridos num único objeto aplicável em `user_preferences`. */
export function mergeSuggestionPatches(
  suggestions: readonly PreferenceCalibrationSuggestion[],
): CalibrationPreferencePatch {
  const merged: CalibrationPreferencePatch = {};
  for (const suggestion of suggestions) {
    Object.assign(merged, suggestion.patch);
  }
  return merged;
}
