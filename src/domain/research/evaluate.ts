import {
  bandOf,
  type ComparableLevel,
  confidenceOf,
  type EstimateConfidence,
  type EstimateSale,
  type EstimateTarget,
  MIN_COMPARABLES,
  percentile,
  similarityOf,
  type SimilarityReason,
} from "../listings/estimates";
import type { VehicleOrigin } from "../listings/origin";
import { vehicleFamilyKey } from "../listings/vehicle-family";
import { type Cents, cents } from "../money";
import {
  DAMAGE_OF_CONDITION,
  RESEARCH_CONDITIONS,
  type ResearchCondition,
  type ResearchMileage,
  type ResearchVehicle,
  researchVehicle,
} from "./filters";

/**
 * Avaliar (docs/PLANO-MERCADO.md §5, D-71): quanto um veículo costuma sair em leilão. O recorte é o modelo base e,
 * se o usuário quiser estreitar, a família ou a versão FIPE, com ano, km, condição e origem. Puro.
 */

export type EvaluateFilters = {
  vehicle: ResearchVehicle | null;
  /** `vehicleFamilyKey` da família escolhida; só com modelo. */
  family: string | null;
  /** Código FIPE da versão escolhida ("005205-1"); só com modelo. */
  version: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  maxKm: ResearchMileage | null;
  condition: ResearchCondition;
  origin: VehicleOrigin | null;
  /** Lote do usuário que serve de alvo (preenche o recorte e ordena as vendas pela semelhança). */
  lot: string | null;
  /** Vendas que o usuário tirou da conta. */
  excluded: readonly string[];
};

export const DEFAULT_EVALUATE_FILTERS: EvaluateFilters = {
  vehicle: null,
  family: null,
  version: null,
  yearFrom: null,
  yearTo: null,
  maxKm: null,
  condition: "sem-monta",
  origin: null,
  lot: null,
  excluded: [],
};

/** Até quantas vendas excluídas a URL guarda: mais que isso é outro recorte, não exclusão. */
export const MAX_EXCLUDED = 50;

/** De que grupo vêm as vendas: a versão ou a família escolhidas ou, sem elas, o modelo base. */
export function evaluationLevel(filters: Pick<EvaluateFilters, "family" | "version">): ComparableLevel {
  if (filters.version !== null) return "version";
  return filters.family === null ? "model" : "family";
}

/** Rótulo da família a partir da chave: "CHEVROLET|ONIX|PLUS" → "ONIX PLUS"; "HONDA|CG|160" → "CG 160". */
export function familyLabel(key: string): string {
  return key.split("|").slice(1).filter(Boolean).join(" ");
}

/** Dimensões do recorte que podem ser contadas sem elas (seletores) ou afrouxadas. */
type CutDimension = "family" | "version" | "years" | "km" | "condition" | "origin";

/** A venda (já do modelo base, pela consulta) está no recorte? `skip` ignora uma dimensão. */
export function inCut(sale: EstimateSale, filters: EvaluateFilters, skip?: CutDimension): boolean {
  if (skip !== "family" && filters.family !== null) {
    if (vehicleFamilyKey(sale.brand, sale.model, sale.category) !== filters.family) return false;
  }
  if (skip !== "version" && filters.version !== null && sale.fipeCode !== filters.version) return false;
  if (skip !== "years") {
    if (filters.yearFrom !== null && (sale.modelYear === null || sale.modelYear < filters.yearFrom)) return false;
    if (filters.yearTo !== null && (sale.modelYear === null || sale.modelYear > filters.yearTo)) return false;
  }
  // Sem km informado não dá para dizer que está abaixo do teto (a Pesquisa faz o mesmo).
  if (skip !== "km" && filters.maxKm !== null && (sale.mileageKm === null || sale.mileageKm > filters.maxKm)) {
    return false;
  }
  if (skip !== "condition" && sale.damageLevel !== DAMAGE_OF_CONDITION[filters.condition]) return false;
  if (skip !== "origin" && filters.origin !== null && sale.origin !== filters.origin) return false;
  return true;
}

export type EvaluateAnswer =
  | {
      kind: "band";
      n: number;
      median: Cents;
      /** Faixa onde cai metade das próximas vendas (`bandOf`). */
      low: Cents;
      high: Cents;
      confidence: EstimateConfidence;
      /** Mediana do lance final ÷ valor de mercado, nas vendas com valor de mercado; `null` sem nenhuma. */
      marketRatio: number | null;
      from: Date;
      to: Date;
    }
  /** Menos de 5 vendas: elas aparecem uma a uma, sem faixa. */
  | { kind: "few"; n: number; needed: number };

export type EvaluateComparable<S> = {
  sale: S;
  excluded: boolean;
  /** Semelhança com o lote alvo; `null` sem lote. */
  similarity: { score: number; reasons: readonly SimilarityReason[] } | null;
};

/** Afrouxar um filtro, com quantas vendas ficariam. */
export type EvaluateLoosen = { change: "years" | "km" | "origin" | "version" | "family"; n: number };

export type EvaluateOption = { value: string; n: number };

export type Evaluation<S> = {
  level: ComparableLevel;
  /** Vendas do recorte, excluídas inclusive (marcadas), na ordem da lista. */
  comparables: EvaluateComparable<S>[];
  answer: EvaluateAnswer;
  excluded: number;
  /** Só os que aumentam a amostra. */
  loosen: EvaluateLoosen[];
  /** Contagens para os seletores: cada uma com os outros filtros e sem a própria dimensão. */
  families: EvaluateOption[];
  versions: EvaluateOption[];
  origins: Record<VehicleOrigin, number>;
};

const ROUND_TO_CENTS = 10_000;
const rough = (value: number) => cents(Math.round(value / ROUND_TO_CENTS) * ROUND_TO_CENTS);

/**
 * Avalia o recorte sobre as vendas do modelo base (o banco já filtrou o modelo e a janela de um ano). Com 5 vendas ou
 * mais fora as excluídas, faixa, mediana e confiança como no preço provável (`bandOf`, `confidenceOf`, D-72); com
 * menos, a contagem e as sugestões de afrouxar. Com lote alvo, a lista vem pela semelhança; sem ele, pela data.
 */
export function evaluate<S extends EstimateSale>(
  sales: readonly S[],
  filters: EvaluateFilters,
  target: EstimateTarget | null,
): Evaluation<S> {
  const excludedIds = new Set(filters.excluded);
  const kept = sales.filter((sale) => !excludedIds.has(sale.id));
  const matching = sales.filter((sale) => inCut(sale, filters));
  const used = matching.filter((sale) => !excludedIds.has(sale.id));

  const comparables = matching
    .map((sale) => ({
      sale,
      excluded: excludedIds.has(sale.id),
      similarity: target === null ? null : similarityOf(target, sale),
    }))
    .sort(
      (a, b) =>
        (b.similarity?.score ?? 0) - (a.similarity?.score ?? 0) || b.sale.endsAt.getTime() - a.sale.endsAt.getTime(),
    );

  const count = (change: Partial<EvaluateFilters>) =>
    kept.filter((sale) => inCut(sale, { ...filters, ...change })).length;
  const hasYears = filters.yearFrom !== null || filters.yearTo !== null;
  const loosen: EvaluateLoosen[] = [
    ...(hasYears
      ? [
          {
            change: "years" as const,
            n: count({
              yearFrom: filters.yearFrom === null ? null : filters.yearFrom - 1,
              yearTo: filters.yearTo === null ? null : filters.yearTo + 1,
            }),
          },
        ]
      : []),
    ...(filters.maxKm === null ? [] : [{ change: "km" as const, n: count({ maxKm: null }) }]),
    ...(filters.origin === null ? [] : [{ change: "origin" as const, n: count({ origin: null }) }]),
    ...(filters.version === null ? [] : [{ change: "version" as const, n: count({ version: null }) }]),
    ...(filters.family === null ? [] : [{ change: "family" as const, n: count({ family: null }) }]),
  ].filter((option) => option.n > used.length);

  const tally = (dimension: CutDimension, keyOf: (sale: S) => string | null): EvaluateOption[] => {
    const counts = new Map<string, number>();
    for (const sale of kept) {
      const key = inCut(sale, filters, dimension) ? keyOf(sale) : null;
      if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts].map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n || a.value.localeCompare(b.value));
  };
  const origins: Record<VehicleOrigin, number> = {
    financiamento: 0,
    seguradora: 0,
    frota: 0,
    orgao_publico: 0,
    outros: 0,
  };
  for (const sale of kept) {
    if (sale.origin !== null && inCut(sale, filters, "origin")) origins[sale.origin] += 1;
  }

  return {
    level: evaluationLevel(filters),
    comparables,
    answer: answerOf(used),
    excluded: matching.length - used.length,
    loosen,
    families: tally("family", (sale) => vehicleFamilyKey(sale.brand, sale.model, sale.category)),
    versions: tally("version", (sale) => sale.fipeCode),
    origins,
  };
}

function answerOf(used: readonly EstimateSale[]): EvaluateAnswer {
  if (used.length < MIN_COMPARABLES) return { kind: "few", n: used.length, needed: MIN_COMPARABLES };
  const bids = used.map((sale) => sale.finalBid).sort((a, b) => a - b);
  const band = bandOf(bids);
  const p25 = percentile(bids, 0.25);
  const p75 = percentile(bids, 0.75);
  const ratios = used
    .flatMap((sale) => (sale.marketValue !== null && sale.marketValue > 0 ? [sale.finalBid / sale.marketValue] : []))
    .sort((a, b) => a - b);
  const times = used.map((sale) => sale.endsAt.getTime());
  return {
    kind: "band",
    n: used.length,
    median: rough(band.median),
    low: rough(band.low),
    high: rough(band.high),
    confidence: confidenceOf({
      n: used.length,
      spread: band.median > 0 ? (p75 - p25) / band.median : Number.POSITIVE_INFINITY,
    }),
    marketRatio: ratios.length === 0 ? null : percentile(ratios, 0.5),
    from: new Date(Math.min(...times)),
    to: new Date(Math.max(...times)),
  };
}

/**
 * Recorte inicial a partir de um lote (`?lote=<id>` sem modelo na URL): o mesmo do preço provável (modelo base, ano ±1
 * e a condição declarada), para os números baterem; família, versão e origem ficam para o usuário estreitar.
 */
export function targetFilters(target: EstimateTarget, lot: string, excluded: readonly string[]): EvaluateFilters {
  const vehicle = target.brand === null || target.model === null ? null : researchVehicle(target.brand, target.model);
  return {
    ...DEFAULT_EVALUATE_FILTERS,
    vehicle,
    yearFrom: vehicle === null || target.modelYear === null ? null : target.modelYear - 1,
    yearTo: vehicle === null || target.modelYear === null ? null : target.modelYear + 1,
    condition:
      RESEARCH_CONDITIONS.find((condition) => DAMAGE_OF_CONDITION[condition] === target.damageLevel) ??
      DEFAULT_EVALUATE_FILTERS.condition,
    lot,
    excluded,
  };
}
