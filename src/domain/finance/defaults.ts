import type { DamageLevel } from "../listings/condition";
import { applyRate, type Bps, bps, type Cents, cents } from "../money";
import { type AnalysisInputs, calculateMaxBid, type MaxBidOutcome } from "./calculator";

/**
 * Premissas padrão da análise (D-38): pessimistas, para o rascunho nascer preenchido e o usuário só revisar.
 * Puro: quem chama informa a FIPE, a condição declarada e o que a fonte já cobra.
 *
 * - Valor de venda = FIPE − desconto pela condição (carro de leilão vende abaixo da tabela).
 * - Reparos = % da FIPE pela condição, com piso, mais acréscimos por airbag acionado e peças faltando.
 * - Pneus e revisão sempre entram (pessimista); documentação e transporte usam o valor do anúncio quando há.
 * - Reserva e margem em % do valor de venda.
 */

/** Desconto sobre a FIPE para chegar ao valor de venda, pela monta declarada. Sucata não tem valor de venda padrão. */
export const SALE_DISCOUNT_BPS = {
  none: bps(1_300),
  small: bps(2_000),
  medium: bps(3_000),
  large: bps(4_000),
} as const;

/** Reparos em % da FIPE, pela monta declarada. */
export const REPAIR_RATE_BPS = {
  none: bps(500),
  small: bps(1_500),
  medium: bps(3_000),
  large: bps(5_000),
} as const;

/** Perfil operacional do comprador para ajustar premissas padrão da calculadora v3 (D-96). */
export const BUYER_PROFILES = ["reseller", "personal", "advisor"] as const;
export type BuyerProfile = (typeof BUYER_PROFILES)[number];
export const DEFAULT_BUYER_PROFILE: BuyerProfile = "reseller";

/** Margem desejada padrão por perfil operacional quando o usuário não define sobrescrita explícita. */
export const PROFILE_DESIRED_MARGIN_BPS = {
  reseller: bps(1_500),
  advisor: bps(1_000),
  personal: bps(0),
} satisfies Record<BuyerProfile, Bps>;

export const DEFAULT_COSTS = {
  car: { repairFloor: cents(200_000), tires: cents(240_000), service: cents(150_000) },
  motorcycle: { repairFloor: cents(80_000), tires: cents(90_000), service: cents(60_000) },
  airbagDeployed: cents(800_000),
  missingParts: cents(300_000),
  documentation: cents(150_000),
  /** Guincho: saída + por km de estrada até o pátio. */
  towBase: cents(30_000),
  towPerKm: cents(600),
  /** Sem local do pátio: guincho de uma distância média. */
  towUnknownDistance: cents(150_000),
  otherFees: cents(0),
  debts: cents(0),
  selling: cents(0),
  tax: cents(0),
  commissionRate: bps(500),
  riskReserveRate: bps(500),
  desiredMarginRate: bps(1_500),
} as const;

/** Distância em linha reta → estrada (as rodovias raramente são retas). */
export const ROAD_FACTOR = 1.3;

/** Arredondamentos: valor de venda para baixo e custos para cima, a R$ 100 / R$ 10 (pessimista). */
const SALE_STEP = 10_000;
const REPAIR_STEP = 10_000;
const TOW_STEP = 1_000;

export type DefaultsInput = {
  /** FIPE do veículo exato (a fonte mostra; o usuário digita). */
  fipe: Cents | null;
  isMotorcycle: boolean;
  damageLevel: DamageLevel | null;
  airbagDeployed: boolean;
  missingParts: boolean;
  /** O que o anúncio já informa; `null` = não informa. */
  dispatcherFee: Cents | null;
  removalFee: Cents | null;
  otherFees: Cents | null;
  commissionRate: Bps | null;
  /** Distância em linha reta do pátio à região do usuário; `null` = local desconhecido. */
  distanceKm: number | null;
};

/** De onde veio cada número, para a nota do rascunho. */
export type DefaultsBasis = {
  buyerProfile: BuyerProfile;
  condition: DamageLevel | "none";
  saleDiscount: Bps | null;
  repairRate: Bps | null;
  documentation: "listing" | "default";
  transport: "listing" | "distance" | "unknown_distance";
  roadKm: number | null;
  otherFees: "listing" | "default";
  commission: "listing" | "default";
};

export type DefaultAssumptions = {
  marketValue: Cents | null;
  repairCost: Cents | null;
  documentationCost: Cents;
  transportCost: Cents;
  tiresCost: Cents;
  serviceCost: Cents;
  otherFees: Cents;
  debtsCost: Cents;
  sellingCost: Cents;
  taxCost: Cents;
  commissionRateBps: Bps;
  riskReserveRateBps: Bps;
  desiredMarginRateBps: Bps;
  basis: DefaultsBasis;
};

/** Sobrescritas opcionais das premissas padrão definidas nas preferências do usuário. */
export type UserDefaultOverrides = {
  buyerProfile?: BuyerProfile | null;
  desiredMarginRateBps?: Bps | null;
  riskReserveRateBps?: Bps | null;
  documentationCost?: Cents | null;
  towBase?: Cents | null;
  towPerKm?: Cents | null;
  towUnknownDistance?: Cents | null;
  saleDiscountNoneBps?: Bps | null;
  saleDiscountSmallBps?: Bps | null;
  saleDiscountMediumBps?: Bps | null;
  saleDiscountLargeBps?: Bps | null;
};

function resolveSaleDiscount(level: keyof typeof SALE_DISCOUNT_BPS, overrides?: UserDefaultOverrides | null): Bps {
  switch (level) {
    case "none":
      return overrides?.saleDiscountNoneBps ?? SALE_DISCOUNT_BPS.none;
    case "small":
      return overrides?.saleDiscountSmallBps ?? SALE_DISCOUNT_BPS.small;
    case "medium":
      return overrides?.saleDiscountMediumBps ?? SALE_DISCOUNT_BPS.medium;
    case "large":
      return overrides?.saleDiscountLargeBps ?? SALE_DISCOUNT_BPS.large;
  }
}

/** Valor de venda e reparos a partir da FIPE; sem FIPE (ou sucata), ficam vazios para o usuário. */
export function estimateFromFipe(
  input: Pick<DefaultsInput, "fipe" | "isMotorcycle" | "damageLevel" | "airbagDeployed" | "missingParts">,
  overrides?: UserDefaultOverrides | null,
): { marketValue: Cents | null; repairCost: Cents | null; saleDiscount: Bps | null; repairRate: Bps | null } {
  const level = input.damageLevel ?? "none";
  if (input.fipe === null || input.fipe <= 0 || level === "salvage") {
    return { marketValue: null, repairCost: null, saleDiscount: null, repairRate: null };
  }
  const saleDiscount = resolveSaleDiscount(level, overrides);
  const repairRate = REPAIR_RATE_BPS[level];
  const sale = input.fipe - applyRate(input.fipe, saleDiscount);
  const floor = (input.isMotorcycle ? DEFAULT_COSTS.motorcycle : DEFAULT_COSTS.car).repairFloor;
  const extras =
    (input.airbagDeployed ? DEFAULT_COSTS.airbagDeployed : 0) + (input.missingParts ? DEFAULT_COSTS.missingParts : 0);
  const repair = Math.max(applyRate(input.fipe, repairRate), floor) + extras;
  return {
    marketValue: cents(Math.floor(sale / SALE_STEP) * SALE_STEP),
    repairCost: roundUp(repair, REPAIR_STEP),
    saleDiscount,
    repairRate,
  };
}

/** Guincho até o pátio pela distância de estrada estimada. */
export function towCost(distanceKm: number, overrides?: UserDefaultOverrides | null): { cost: Cents; roadKm: number } {
  const roadKm = Math.round(distanceKm * ROAD_FACTOR);
  const towBase = overrides?.towBase ?? DEFAULT_COSTS.towBase;
  const towPerKm = overrides?.towPerKm ?? DEFAULT_COSTS.towPerKm;
  return { cost: roundUp(towBase + towPerKm * roadKm, TOW_STEP), roadKm };
}

export function defaultAssumptions(input: DefaultsInput, overrides?: UserDefaultOverrides | null): DefaultAssumptions {
  const buyerProfile = overrides?.buyerProfile ?? DEFAULT_BUYER_PROFILE;
  const vehicle = input.isMotorcycle ? DEFAULT_COSTS.motorcycle : DEFAULT_COSTS.car;
  const fromFipe = estimateFromFipe(input, overrides);
  const tow = input.distanceKm === null ? null : towCost(input.distanceKm, overrides);
  const transportCost =
    input.removalFee ?? tow?.cost ?? overrides?.towUnknownDistance ?? DEFAULT_COSTS.towUnknownDistance;

  return {
    marketValue: fromFipe.marketValue,
    repairCost: fromFipe.repairCost,
    documentationCost: input.dispatcherFee ?? overrides?.documentationCost ?? DEFAULT_COSTS.documentation,
    transportCost,
    tiresCost: vehicle.tires,
    serviceCost: vehicle.service,
    otherFees: input.otherFees ?? DEFAULT_COSTS.otherFees,
    debtsCost: DEFAULT_COSTS.debts,
    sellingCost: DEFAULT_COSTS.selling,
    taxCost: DEFAULT_COSTS.tax,
    commissionRateBps: input.commissionRate ?? DEFAULT_COSTS.commissionRate,
    riskReserveRateBps: overrides?.riskReserveRateBps ?? DEFAULT_COSTS.riskReserveRate,
    desiredMarginRateBps: overrides?.desiredMarginRateBps ?? PROFILE_DESIRED_MARGIN_BPS[buyerProfile],
    basis: {
      buyerProfile,
      condition: input.damageLevel ?? "none",
      saleDiscount: fromFipe.saleDiscount,
      repairRate: fromFipe.repairRate,
      documentation: input.dispatcherFee === null ? "default" : "listing",
      transport: input.removalFee !== null ? "listing" : tow === null ? "unknown_distance" : "distance",
      roadKm: input.removalFee === null ? (tow?.roadKm ?? null) : null,
      otherFees: input.otherFees === null ? "default" : "listing",
      commission: input.commissionRate === null ? "default" : "listing",
    },
  };
}

/** Premissas padrão → entradas da calculadora: comissão em %, reserva e margem em % do valor de venda. */
export function defaultInputs(input: DefaultsInput, overrides?: UserDefaultOverrides | null): AnalysisInputs {
  const defaults = defaultAssumptions(input, overrides);
  return {
    marketValue: defaults.marketValue,
    repairCost: defaults.repairCost,
    documentationCost: defaults.documentationCost,
    transportCost: defaults.transportCost,
    tiresCost: defaults.tiresCost,
    serviceCost: defaults.serviceCost,
    otherFees: defaults.otherFees,
    debtsCost: defaults.debtsCost,
    sellingCost: defaults.sellingCost,
    taxCost: defaults.taxCost,
    commissionMode: "percentage",
    commissionFixed: null,
    commissionRateBps: defaults.commissionRateBps,
    riskReserve: null,
    riskReserveRateBps: defaults.riskReserveRateBps,
    desiredMargin: null,
    desiredMarginRateBps: defaults.desiredMarginRateBps,
  };
}

/**
 * Limite pelas premissas padrão (D-44): a mesma conta do rascunho que nasce com elas. Sem FIPE ou sucata, o valor de
 * venda e os reparos ficam vazios e o resultado é "incompleto".
 */
export function defaultMaxBid(input: DefaultsInput, overrides?: UserDefaultOverrides | null): MaxBidOutcome {
  return calculateMaxBid(defaultInputs(input, overrides));
}

/** Prefixo das observações geradas automaticamente para rascunhos criados com premissas padrão (D-38). */
export const DEFAULT_DRAFT_NOTES_PREFIX = "Premissas padrão, pessimistas";

/**
 * Rascunho criado com as premissas padrão e nunca editado pelo usuário (nem em valores nem nas notas).
 * Usado para alertar antes de fixar em lote diretamente pelo dashboard.
 */
export function isUnreviewedDefaultDraft(draft: { createdAt: Date; updatedAt: Date; notes: string | null }): boolean {
  return (
    draft.updatedAt.getTime() === draft.createdAt.getTime() &&
    Boolean(draft.notes?.startsWith(DEFAULT_DRAFT_NOTES_PREFIX))
  );
}

function roundUp(value: number, step: number): Cents {
  return cents(Math.ceil(value / step) * step);
}
