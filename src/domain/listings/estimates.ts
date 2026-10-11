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
import type { VehicleOrigin } from "./origin";
import { vehicleFamilyKey } from "./vehicle-family";
import { vehicleKey } from "./vehicle-key";

/**
 * Estimativas com dados do próprio sistema (docs/PLANO-COLETA.md §5, etapa 5; D-28, D-36). Puro.
 *
 * - **Preço provável:** lances finais de vendas comparáveis já encerradas no catálogo, de qualquer região (o leilão
 *   é online). Sem comparáveis suficientes, a proporção lance final ÷ valor de mercado das vendas da mesma categoria
 *   e condição, aplicada ao valor de mercado (da fonte ou casado na FIPE, D-47). Sempre com o número de casos.
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

type Vehicle = {
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  mileageKm: number | null;
  category: string | null;
  damageLevel: DamageLevel | null;
  /** Código FIPE da versão (da fonte ou casado, D-47); nulo sem versão conhecida. */
  fipeCode: string | null;
  /** Origem inferida (D-73); nula quando não se sabe (lote cadastrado à mão). */
  origin: VehicleOrigin | null;
};

/** Venda encerrada do catálogo (situação vendido, com lance final positivo). */
export type EstimateSale = Vehicle & { id: string; endsAt: Date; finalBid: Cents; marketValue: Cents | null };

/** Anúncio a estimar. */
export type EstimateTarget = Vehicle & { marketValue: Cents | null };

/**
 * De onde vêm os comparáveis (docs/PLANO-MERCADO.md, D-72), do mais estreito ao mais largo: a mesma versão FIPE, a
 * mesma família (`vehicleFamilyKey`) e o mesmo modelo base (`vehicleKey`). Em todos, ano ±1, mesma condição e km
 * próximo (`isComparable`).
 */
export const COMPARABLE_LEVELS = ["version", "family", "model"] as const;
export type ComparableLevel = (typeof COMPARABLE_LEVELS)[number];

/** Quanto a faixa merece confiança: pelo nível, pelo número de vendas e pela largura da faixa (`confidenceOf`). */
export const ESTIMATE_CONFIDENCES = ["high", "medium", "low"] as const;
export type EstimateConfidence = (typeof ESTIMATE_CONFIDENCES)[number];

export type PriceEstimate =
  | {
      kind: "comparables";
      level: ComparableLevel;
      /** Só vendas da mesma origem do alvo (havia 5 ou mais delas no nível). */
      sameOrigin: boolean;
      confidence: EstimateConfidence;
      n: number;
      median: Cents;
      low: Cents;
      high: Cents;
      /** As vendas usadas, para mostrar de onde veio o número. */
      saleIds: readonly string[];
    }
  | {
      kind: "market_ratio";
      confidence: "low";
      n: number;
      median: Cents;
      low: Cents;
      high: Cents;
      /** Lance final ÷ valor de mercado (0,53 = 53%); pode passar de 1. */
      ratio: { median: number; low: number; high: number };
    }
  | { kind: "insufficient"; comparables: number; needed: number };

/** Vendas indexadas para estimar vários anúncios de uma vez (uma tela de cartões). */
export type EstimateIndex = {
  byLevel: Record<ComparableLevel, Map<string, EstimateSale[]>>;
  /** Proporções ordenadas por categoria e condição (`ratioKey`). */
  ratios: Map<string, number[]>;
};

export type EstimateOptions = {
  /** Níveis tentados, em ordem. */
  levels: readonly ComparableLevel[];
  /** Com 5 ou mais vendas da mesma origem no nível, usa só elas. */
  preferOrigin: boolean;
  /** Vendas que o usuário tirou da conta (tela Avaliar). */
  exclude?: ReadonlySet<string>;
};

/**
 * O motor das telas, escolhido pelo backtest (T0.6, D-72): só o modelo base. Versão e família deixam os grupos menores
 * sem baixar o erro (12,4% contra 11,8% nos alvos com versão; 21,2% contra 22,1% nos com família), e a preferência
 * por origem piora a faixa. Versão, família e origem ficam como recortes que o usuário escolhe na tela Avaliar.
 */
export const DEFAULT_ESTIMATE_OPTIONS: EstimateOptions = { levels: ["model"], preferOrigin: false };

const ratioKey = (vehicle: Pick<Vehicle, "category" | "damageLevel">) =>
  `${vehicle.category ?? ""}|${vehicle.damageLevel ?? ""}`;

/** Chave do veículo em cada nível; `null` quando o nível não se aplica (sem versão FIPE, sem marca ou modelo). */
export function levelKey(level: ComparableLevel, vehicle: Vehicle): string | null {
  switch (level) {
    case "version":
      return vehicle.fipeCode;
    case "family":
      return vehicleFamilyKey(vehicle.brand, vehicle.model, vehicle.category);
    case "model":
      return vehicleKey(vehicle.brand, vehicle.model);
  }
}

export function buildEstimateIndex(sales: readonly EstimateSale[]): EstimateIndex {
  const byLevel: EstimateIndex["byLevel"] = { version: new Map(), family: new Map(), model: new Map() };
  const ratios = new Map<string, number[]>();
  for (const sale of sales) {
    if (sale.finalBid <= 0) continue;
    for (const level of COMPARABLE_LEVELS) {
      const key = levelKey(level, sale);
      if (key !== null) pushTo(byLevel[level], key, sale);
    }
    if (sale.marketValue !== null && sale.marketValue > 0)
      pushTo(ratios, ratioKey(sale), sale.finalBid / sale.marketValue);
  }
  for (const values of ratios.values()) values.sort((a, b) => a - b);
  return { byLevel, ratios };
}

/**
 * Entre vendas do mesmo grupo (garantido pelo índice): ano ±1, mesma condição declarada (sem declaração só compara
 * com sem declaração) e quilometragem a até 40 mil km, quando as duas são conhecidas.
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

export type ComparableSet = { level: ComparableLevel; sameOrigin: boolean; sales: EstimateSale[] };

/**
 * Comparáveis do alvo: o primeiro nível com 5 vendas ou mais. `largest` é o maior número achado em algum nível, para
 * dizer quantas faltam quando nenhum basta.
 */
export function findComparables(
  target: EstimateTarget,
  index: EstimateIndex,
  options: EstimateOptions = DEFAULT_ESTIMATE_OPTIONS,
): { found: ComparableSet | null; largest: number } {
  let largest = 0;
  for (const level of options.levels) {
    const key = levelKey(level, target);
    if (key === null) continue;
    const sales = (index.byLevel[level].get(key) ?? []).filter(
      (sale) => !options.exclude?.has(sale.id) && isComparable(target, sale),
    );
    largest = Math.max(largest, sales.length);
    if (sales.length < MIN_COMPARABLES) continue;
    const sameOrigin = target.origin === null ? [] : sales.filter((sale) => sale.origin === target.origin);
    if (options.preferOrigin && sameOrigin.length >= MIN_COMPARABLES) {
      return { found: { level, sameOrigin: true, sales: sameOrigin }, largest };
    }
    return { found: { level, sameOrigin: false, sales }, largest };
  }
  return { found: null, largest };
}

export function estimatePrice(
  target: EstimateTarget,
  index: EstimateIndex,
  options: EstimateOptions = DEFAULT_ESTIMATE_OPTIONS,
): PriceEstimate {
  const { found, largest } = findComparables(target, index, options);

  if (found !== null) {
    const bids = found.sales.map((sale) => sale.finalBid).sort((a, b) => a - b);
    const band = bandOf(bids);
    const quartiles = { low: percentile(bids, 0.25), median: percentile(bids, 0.5), high: percentile(bids, 0.75) };
    return {
      kind: "comparables",
      level: found.level,
      sameOrigin: found.sameOrigin,
      confidence: confidenceOf({ n: bids.length, spread: spreadOf(quartiles) }),
      n: bids.length,
      median: rough(band.median),
      low: rough(band.low),
      high: rough(band.high),
      saleIds: found.sales.map((sale) => sale.id),
    };
  }

  // Sem categoria não há grupo confiável para a proporção.
  const ratios = target.category === null ? [] : (index.ratios.get(ratioKey(target)) ?? []);
  if (target.marketValue !== null && target.marketValue > 0 && ratios.length >= MIN_RATIO_SAMPLE) {
    const ratio = bandOf(ratios);
    const apply = (value: number) => rough((target.marketValue ?? 0) * value);
    return {
      kind: "market_ratio",
      confidence: "low",
      n: ratios.length,
      median: apply(ratio.median),
      low: apply(ratio.low),
      high: apply(ratio.high),
      ratio,
    };
  }

  return { kind: "insufficient", comparables: largest, needed: MIN_COMPARABLES };
}

/**
 * Faixa onde cai metade das próximas vendas: os quantis `0,5 ± 0,25 × (n + 1) ÷ (n − 1)` das vendas ordenadas. Com
 * poucas vendas, a P25–P75 da amostra é estreita demais (com 5 vendas, só 1 em 3 das seguintes cairia nela); a
 * correção vem das estatísticas de ordem e some com amostras grandes (P12,5–P87,5 com 5; P24–P76 com 50). Lista
 * ordenada com 2 itens ou mais.
 */
export function bandOf(sorted: readonly number[]): { low: number; median: number; high: number } {
  const half = Math.min(0.5, (0.25 * (sorted.length + 1)) / Math.max(1, sorted.length - 1));
  return {
    low: percentile(sorted, 0.5 - half),
    median: percentile(sorted, 0.5),
    high: percentile(sorted, 0.5 + half),
  };
}

/** Largura da P25–P75 sobre a mediana; infinita com mediana zero. */
function spreadOf(quartiles: { low: number; median: number; high: number }): number {
  return quartiles.median > 0 ? (quartiles.high - quartiles.low) / quartiles.median : Number.POSITIVE_INFINITY;
}

/** Limiares do backtest (T0.6): erro mediano de 12,6% na alta, 16–22% na média e 25% ou mais na baixa. */
const HIGH_CONFIDENCE_SAMPLE = 20;
const NARROW_SPREAD = 0.4;
const WIDE_SPREAD = 0.6;

/**
 * Confiança da faixa por comparáveis, pelo número de vendas e pela largura da P25–P75 (`spread`, sobre a mediana):
 * **alta** com 20 vendas ou mais e até 40%; **média** com até 40%, ou com 20 vendas ou mais e até 60%; **baixa** no
 * resto. O nível (versão, família, modelo) não entrou: no backtest ele não mudou o erro. A proporção da categoria é
 * sempre baixa (não olha para o veículo).
 */
export function confidenceOf({ n, spread }: { n: number; spread: number }): EstimateConfidence {
  if (spread <= NARROW_SPREAD) return n >= HIGH_CONFIDENCE_SAMPLE ? "high" : "medium";
  if (n >= HIGH_CONFIDENCE_SAMPLE && spread <= WIDE_SPREAD) return "medium";
  return "low";
}

/** Por que uma venda é parecida com o alvo, do mais forte ao mais fraco, para a lista de comparáveis. */
export type SimilarityReason =
  "same_version" | "same_family" | "same_year" | "year_apart" | "same_origin" | "close_mileage" | "same_condition";

/**
 * Semelhança de uma venda com o alvo (ordem da lista de comparáveis): versão, família, ano, origem e km. A nota só
 * ordena; quem decide se a venda entra na conta é `findComparables`.
 */
export function similarityOf(target: Vehicle, sale: Vehicle): { score: number; reasons: readonly SimilarityReason[] } {
  const reasons: SimilarityReason[] = [];
  let score = 0;
  if (target.fipeCode !== null && target.fipeCode === sale.fipeCode) {
    reasons.push("same_version");
    score += 4;
  } else if (levelKey("family", target) !== null && levelKey("family", target) === levelKey("family", sale)) {
    reasons.push("same_family");
    score += 2;
  }
  if (target.modelYear !== null && sale.modelYear !== null) {
    const apart = Math.abs(target.modelYear - sale.modelYear);
    reasons.push(apart === 0 ? "same_year" : "year_apart");
    score += Math.max(0, 2 - apart);
  }
  if (target.origin !== null && target.origin === sale.origin) {
    reasons.push("same_origin");
    score += 1;
  }
  if (target.mileageKm !== null && sale.mileageKm !== null && Math.abs(target.mileageKm - sale.mileageKm) <= 20_000) {
    reasons.push("close_mileage");
    score += 1;
  }
  if (target.damageLevel === sale.damageLevel) reasons.push("same_condition");
  return { score, reasons };
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
 * Preço provável frente ao limite (D-44): **folga** quando até o topo da faixa cabe; **no limite** quando só a mediana cabe;
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
