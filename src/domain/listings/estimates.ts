import {
  type AnalysisInputs,
  calculateMaxBid,
  type CommissionMode,
  completeInputs,
  missingFields,
} from "../finance/calculator";
import { defaultMaxBid, type DefaultsInput, estimateFromFipe } from "../finance/defaults";
import { bps, type Cents, cents } from "../money";
import type { DamageLevel } from "./condition";
import { normalizePlaceName } from "./place";

/**
 * Estimativas com dados do próprio sistema (docs/PLANO-COLETA.md §5, etapa 5; D-28, D-36). Puro.
 *
 * - **Preço provável:** lances finais de vendas comparáveis já encerradas no catálogo, de qualquer região (o leilão
 *   é online). Sem comparáveis suficientes, a proporção lance final ÷ valor de mercado das vendas da mesma categoria
 *   e condição, aplicada ao valor de mercado informado pela fonte. Sempre com o número de casos.
 * - **Limite estimado:** a calculadora da análise (SPEC §7) com as premissas das análises fixadas do usuário para
 *   veículos parecidos; sem 3 delas, com as premissas padrão do próprio anúncio (D-38, D-44). Nunca vira análise fixada.
 * - **Situação:** o preço provável frente ao limite (D-44). Compara o provável, nunca o lance atual, que ainda sobe.
 */

export const MIN_COMPARABLES = 5;
/** Vendas da mesma categoria e condição para usar a proporção do valor de mercado. */
export const MIN_RATIO_SAMPLE = 20;
export const MIN_COMPARABLE_ANALYSES = 3;
const YEAR_TOLERANCE = 1;
const KM_TOLERANCE = 40_000;
/** Estimativa de preço em reais redondos (R$ 100): centavos passariam uma precisão que ela não tem. */
const ROUND_TO_CENTS = 10_000;
/** Vendas mais antigas que isto não entram: o mercado muda. */
export const SALES_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

/** Grafias da mesma marca: a fonte escreve o nome completo, o usuário às vezes abrevia. */
export const BRAND_ALIASES: Readonly<Record<string, string>> = {
  VW: "VOLKSWAGEN",
  GM: "CHEVROLET",
  // normalizePlaceName troca hífen por espaço: "MERCEDES-BENZ" vira "MERCEDES BENZ".
  MERCEDES: "MERCEDES BENZ",
};

type Vehicle = {
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  mileageKm: number | null;
  category: string | null;
  damageLevel: DamageLevel | null;
};

/** Venda encerrada do catálogo (situação vendido, com lance final positivo). */
export type EstimateSale = Vehicle & { finalBid: Cents; marketValue: Cents | null };

/** Anúncio a estimar. */
export type EstimateTarget = Vehicle & { marketValue: Cents | null };

export type PriceEstimate =
  | { kind: "comparables"; n: number; median: Cents; low: Cents; high: Cents }
  | {
      kind: "market_ratio";
      n: number;
      median: Cents;
      low: Cents;
      high: Cents;
      /** Lance final ÷ valor de mercado (0,53 = 53%); pode passar de 1. */
      ratio: { median: number; low: number; high: number };
    }
  | { kind: "insufficient"; comparables: number; needed: number };

/**
 * Marca e modelo base comparáveis entre fonte e Tracker: sem acento, maiúsculas, marca por extenso e só a primeira
 * palavra do modelo ("ONIX PLUS JOY BLACK" → "ONIX"). `null` sem marca ou modelo.
 */
export function vehicleKey(brand: string | null, model: string | null): string | null {
  const normalizedBrand = normalizePlaceName(brand ?? "").trim();
  const [baseModel] = normalizePlaceName(model ?? "")
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  if (normalizedBrand === "" || baseModel === undefined) return null;
  return `${BRAND_ALIASES[normalizedBrand] ?? normalizedBrand}|${baseModel}`;
}

/** Vendas indexadas para estimar vários anúncios de uma vez (uma tela de cartões). */
export type EstimateIndex = {
  byVehicle: Map<string, EstimateSale[]>;
  /** Proporções ordenadas por categoria e condição (`ratioKey`). */
  ratios: Map<string, number[]>;
};

const ratioKey = (vehicle: Pick<Vehicle, "category" | "damageLevel">) =>
  `${vehicle.category ?? ""}|${vehicle.damageLevel ?? ""}`;

export function buildEstimateIndex(sales: readonly EstimateSale[]): EstimateIndex {
  const byVehicle = new Map<string, EstimateSale[]>();
  const ratios = new Map<string, number[]>();
  for (const sale of sales) {
    if (sale.finalBid <= 0) continue;
    const key = vehicleKey(sale.brand, sale.model);
    if (key !== null) pushTo(byVehicle, key, sale);
    if (sale.marketValue !== null && sale.marketValue > 0)
      pushTo(ratios, ratioKey(sale), sale.finalBid / sale.marketValue);
  }
  for (const values of ratios.values()) values.sort((a, b) => a - b);
  return { byVehicle, ratios };
}

/**
 * Entre vendas do mesmo veículo (`vehicleKey`, garantido pelo índice): ano ±1, mesma condição declarada (sem
 * declaração só compara com sem declaração) e quilometragem a até 40 mil km, quando as duas são conhecidas.
 */
export function isComparable(target: Vehicle, sale: Vehicle): boolean {
  if (target.modelYear === null || sale.modelYear === null) return false;
  if (Math.abs(target.modelYear - sale.modelYear) > YEAR_TOLERANCE) return false;
  if (target.damageLevel !== sale.damageLevel) return false;
  if (target.mileageKm !== null && sale.mileageKm !== null) {
    return Math.abs(target.mileageKm - sale.mileageKm) <= KM_TOLERANCE;
  }
  return true;
}

export function estimatePrice(target: EstimateTarget, index: EstimateIndex): PriceEstimate {
  const key = vehicleKey(target.brand, target.model);
  const comparables = key === null ? [] : (index.byVehicle.get(key) ?? []).filter((sale) => isComparable(target, sale));

  if (comparables.length >= MIN_COMPARABLES) {
    const bids = comparables.map((sale) => sale.finalBid).sort((a, b) => a - b);
    return {
      kind: "comparables",
      n: bids.length,
      median: rough(percentile(bids, 0.5)),
      low: rough(percentile(bids, 0.25)),
      high: rough(percentile(bids, 0.75)),
    };
  }

  // Sem categoria não há grupo confiável para a proporção.
  const ratios = target.category === null ? [] : (index.ratios.get(ratioKey(target)) ?? []);
  if (target.marketValue !== null && target.marketValue > 0 && ratios.length >= MIN_RATIO_SAMPLE) {
    const ratio = { median: percentile(ratios, 0.5), low: percentile(ratios, 0.25), high: percentile(ratios, 0.75) };
    const apply = (value: number) => rough((target.marketValue ?? 0) * value);
    return {
      kind: "market_ratio",
      n: ratios.length,
      median: apply(ratio.median),
      low: apply(ratio.low),
      high: apply(ratio.high),
      ratio,
    };
  }

  return { kind: "insufficient", comparables: comparables.length, needed: MIN_COMPARABLES };
}

/** Análise fixada do usuário: o veículo do lote e as entradas que ele usou. */
export type AnalysisSample = Pick<Vehicle, "brand" | "model" | "modelYear"> & { inputs: AnalysisInputs };

export type LimitEstimate =
  /** `maxBid` nulo: com essas premissas, nenhum lance preserva a margem. */
  | {
      kind: "estimated";
      n: number;
      maxBid: Cents | null;
      /** De onde veio o valor de mercado: a FIPE do anúncio ou, sem ela, a mediana das análises. */
      marketValueFrom: "listing" | "analyses";
    }
  /** Sem análises parecidas suficientes: premissas padrão (D-38) com os dados do anúncio. `analyses` = as que havia. */
  | { kind: "defaults"; maxBid: Cents | null; analyses: number; needed: number }
  | { kind: "insufficient"; analyses: number; needed: number };

/**
 * Limite estimado: mediana de cada premissa das análises fixadas do usuário para veículos da mesma marca, modelo base
 * e ano ±1, na calculadora atual. O valor de venda sai da FIPE do próprio anúncio (do veículo exato) menos o desconto
 * pela condição (D-38); sem ela, a mediana das análises. Reserva e margem entram em % do valor de venda (mediana do %
 * de cada análise). A comissão segue a modalidade mais usada nessas análises.
 *
 * Sem 3 análises parecidas, usa as premissas padrão do anúncio (`defaults`, D-44); sem FIPE ou sucata, não há limite.
 */
export function estimateLimit(
  target: EstimateTarget,
  analyses: readonly AnalysisSample[],
  defaults: DefaultsInput | null,
): LimitEstimate {
  const key = vehicleKey(target.brand, target.model);
  const similar = analyses.filter(
    (analysis) =>
      key !== null &&
      missingFields(analysis.inputs).length === 0 &&
      vehicleKey(analysis.brand, analysis.model) === key &&
      target.modelYear !== null &&
      analysis.modelYear !== null &&
      Math.abs(target.modelYear - analysis.modelYear) <= YEAR_TOLERANCE,
  );
  if (similar.length < MIN_COMPARABLE_ANALYSES) {
    const fallback = defaults === null ? null : defaultMaxBid(defaults);
    if (fallback === null || fallback.kind === "incomplete") {
      return { kind: "insufficient", analyses: similar.length, needed: MIN_COMPARABLE_ANALYSES };
    }
    return {
      kind: "defaults",
      maxBid: fallback.kind === "viable" ? fallback.maxBid : null,
      analyses: similar.length,
      needed: MIN_COMPARABLE_ANALYSES,
    };
  }

  const inputs = similar.map((analysis) => analysis.inputs);
  const median = (pick: (inputs: AnalysisInputs) => number | null) => medianOf(inputs.map(pick));
  const percentageCount = inputs.filter((input) => input.commissionMode === "percentage").length;
  const commissionMode: CommissionMode = percentageCount * 2 >= inputs.length ? "percentage" : "fixed";
  const rate = median((input) => (input.commissionMode === "percentage" ? input.commissionRateBps : null));
  const fixed = median((input) => (input.commissionMode === "fixed" ? input.commissionFixed : null));
  const listingValue = estimateFromFipe({
    fipe: target.marketValue,
    isMotorcycle: target.category === "Motos",
    damageLevel: target.damageLevel,
    airbagDeployed: false,
    missingParts: false,
  }).marketValue;
  const shareOfSale = (pick: (complete: { marketValue: Cents; riskReserve: Cents; desiredMargin: Cents }) => Cents) =>
    medianOf(
      inputs.map((input) => {
        const complete = completeInputs(input);
        if (!complete.ok || complete.value.marketValue <= 0) return null;
        return Math.min(10_000, (pick(complete.value) * 10_000) / complete.value.marketValue);
      }),
    );
  const reserveRate = shareOfSale((complete) => complete.riskReserve);
  const marginRate = shareOfSale((complete) => complete.desiredMargin);

  const outcome = calculateMaxBid({
    marketValue: listingValue ?? toCents(median((input) => input.marketValue)),
    repairCost: toCents(median((input) => input.repairCost)),
    documentationCost: toCents(median((input) => input.documentationCost)),
    transportCost: toCents(median((input) => input.transportCost)),
    tiresCost: toCents(median((input) => input.tiresCost)),
    serviceCost: toCents(median((input) => input.serviceCost)),
    otherFees: toCents(median((input) => input.otherFees)),
    commissionMode,
    commissionRateBps: commissionMode === "percentage" && rate !== null ? bps(Math.round(rate)) : null,
    commissionFixed: commissionMode === "fixed" ? toCents(fixed) : null,
    riskReserve: null,
    riskReserveRateBps: reserveRate === null ? null : bps(Math.round(reserveRate)),
    desiredMargin: null,
    desiredMarginRateBps: marginRate === null ? null : bps(Math.round(marginRate)),
  });
  // Só entram análises completas, e cada premissa tem ao menos um valor: "incompleto" não acontece. Por segurança,
  // sem limite em vez de um número montado com lacunas.
  if (outcome.kind === "incomplete") return { kind: "insufficient", analyses: 0, needed: MIN_COMPARABLE_ANALYSES };
  return {
    kind: "estimated",
    n: similar.length,
    maxBid: outcome.kind === "viable" ? outcome.maxBid : null,
    marketValueFrom: listingValue === null ? "analyses" : "listing",
  };
}

/** Limite do cartão em reais, se há um viável (pelas análises ou pelas premissas padrão). */
export function limitMaxBid(limit: LimitEstimate): Cents | null {
  return limit.kind === "insufficient" ? null : limit.maxBid;
}

/**
 * Preço provável frente ao limite (D-44): **folga** quando até o P75 cabe; **no limite** quando só a mediana cabe;
 * **acima** quando nem a mediana cabe. Sem provável ou sem limite viável, não há comparação (`null`).
 */
export type LimitFit = "comfortable" | "tight" | "above";

export function limitFit(price: PriceEstimate, maxBid: Cents | null): LimitFit | null {
  if (price.kind === "insufficient" || maxBid === null) return null;
  if (price.high <= maxBid) return "comfortable";
  if (price.median <= maxBid) return "tight";
  return "above";
}

/** O que a ordem de "Para analisar agora" precisa de cada anúncio. */
export type AnalysisCandidate = { price: PriceEstimate; fit: LimitFit | null; endsAt: Date | null };

const FIT_RANK: Record<LimitFit, number> = { comfortable: 0, tight: 1, above: 2 };

/**
 * Ordem de "Para analisar agora" (D-44): provável por vendas comparáveis antes do provável pela proporção (só os
 * comparáveis olham para o veículo), folga antes de "no limite" e, por fim, encerra primeiro (sem fim, por último).
 */
export function byAnalysisPriority(a: AnalysisCandidate, b: AnalysisCandidate): number {
  const method = (item: AnalysisCandidate) => (item.price.kind === "comparables" ? 0 : 1);
  const fit = (item: AnalysisCandidate) => (item.fit === null ? 3 : FIT_RANK[item.fit]);
  const end = (item: AnalysisCandidate) => item.endsAt?.getTime() ?? Number.POSITIVE_INFINITY;
  // Sem subtrair os fins: dois sem data dariam Infinity − Infinity = NaN.
  const byEnd = end(a) === end(b) ? 0 : end(a) < end(b) ? -1 : 1;
  return method(a) - method(b) || fit(a) - fit(b) || byEnd;
}

/** Percentil com interpolação linear (mesma definição do `percentile_cont` do Postgres). Lista ordenada, não vazia. */
export function percentile(sorted: readonly number[], p: number): number {
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const a = sorted[lower] ?? 0;
  const b = sorted[upper] ?? a;
  return a + (b - a) * (position - lower);
}

function medianOf(values: readonly (number | null)[]): number | null {
  const known = values.filter((value) => value !== null).sort((a, b) => a - b);
  return known.length === 0 ? null : percentile(known, 0.5);
}

function toCents(value: number | null): Cents | null {
  return value === null ? null : cents(Math.round(value));
}

function pushTo<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function rough(value: number): Cents {
  return cents(Math.round(value / ROUND_TO_CENTS) * ROUND_TO_CENTS);
}
