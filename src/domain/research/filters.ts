import type { DamageLevel } from "../listings/condition";
import { type CategoryKey, MILEAGE_OPTIONS_KM } from "../listings/criteria";
import { vehicleKey } from "../listings/vehicle-key";
import { STATE_NAMES, type StateCode } from "./state-codes";

/**
 * Filtros da Pesquisa (docs/PLANO-PESQUISA.md §4, D-45). As chaves vão na URL. A condição é sempre uma: misturar
 * condições numa mediana esconde que ela pesa mais que o estado.
 */

/** "sem-monta": a fonte não declarou a condição (`damage_level` nulo), o que não quer dizer veículo inteiro. */
export const RESEARCH_CONDITIONS = ["sem-monta", "pequena", "media", "grande", "sucata"] as const;
export type ResearchCondition = (typeof RESEARCH_CONDITIONS)[number];

export const DAMAGE_OF_CONDITION = {
  "sem-monta": null,
  pequena: "small",
  media: "medium",
  grande: "large",
  sucata: "salvage",
} as const satisfies Record<ResearchCondition, DamageLevel | null>;

/** Pesados e outros ficam de fora: quase não têm valor de mercado (§2). */
export const RESEARCH_CATEGORIES = [
  "carros",
  "motos",
  "utilitarios",
  "sucatas",
] as const satisfies readonly CategoryKey[];
export type ResearchCategory = (typeof RESEARCH_CATEGORIES)[number];

/** `ratio`: lance final ÷ valor de mercado. `price`: lance final em R$, só com um modelo escolhido. */
export const RESEARCH_METRICS = ["ratio", "price"] as const;
export type ResearchMetric = (typeof RESEARCH_METRICS)[number];

/** Marca e modelo base, normalizados como nas estimativas (`vehicleKey`). */
export type ResearchVehicle = { brand: string; model: string };

/**
 * Segundo grupo da comparação: o que difere do grupo dos filtros. Cada campo `null` repete o do grupo principal, então
 * "Onix × HB20" só traz o modelo e "SP × GO" só traz o estado.
 */
export type ResearchComparison = { vehicle: ResearchVehicle | null; state: StateCode | null };

export type ResearchFilters = {
  category: ResearchCategory;
  condition: ResearchCondition;
  vehicle: ResearchVehicle | null;
  state: StateCode | null;
  /** Ano-modelo, de e até (inclusive). Só vale com um modelo escolhido: o ano pesa no preço dentro de um modelo. */
  yearFrom: number | null;
  yearTo: number | null;
  /** Id da fonte (leiloeiro); `null` em todas. Fora SP, cada estado vem de uma fonte só (D-45). */
  source: string | null;
  /** Quilometragem máxima (inclusive); com ela, vendas sem km informado ficam de fora. */
  maxKm: ResearchMileage | null;
  /** Compara o grupo dos filtros com outro modelo e/ou outro estado; `null` sem comparação. */
  compare: ResearchComparison | null;
  metric: ResearchMetric;
  /** Só as vendas dos últimos dias (D-75); `null` em toda a janela das estimativas. */
  period: ResearchPeriod | null;
  /** Venda cujos lances o bloco do lance mostra (id do anúncio); não filtra os outros blocos. */
  sale: string | null;
};

/** Períodos oferecidos, em dias (D-75). */
export const RESEARCH_PERIODS = [30, 90] as const;
export type ResearchPeriod = (typeof RESEARCH_PERIODS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Início de um período contado de `now`. */
export function periodStart(period: ResearchPeriod, now: Date): Date {
  return new Date(now.getTime() - period * DAY_MS);
}

/**
 * Períodos que a base já cobre (D-75, revisa a regra de D-45): um período só entra quando há vendas mais antigas que
 * ele; antes disso, "últimos 30 dias" seria a base toda com outro nome.
 */
export function availablePeriods(since: Date | null, now: Date): ResearchPeriod[] {
  if (since === null) return [];
  return RESEARCH_PERIODS.filter((period) => since < periodStart(period, now));
}

/** Faixas de "Km até": as mesmas do catálogo, para o link "Ver lotes abertos" levar o filtro junto. */
export const RESEARCH_MILEAGE_OPTIONS = MILEAGE_OPTIONS_KM;
export type ResearchMileage = (typeof RESEARCH_MILEAGE_OPTIONS)[number];

/** Anos-modelo aceitos na URL. */
export const MODEL_YEAR_BOUNDS = { min: 1950, max: 2100 } as const;

/**
 * Faixa de anos já pronta para o filtro: valor fora dos limites vira ausente e, se vierem trocados, a faixa se
 * inverte (2020 a 2018 é 2018 a 2020).
 */
export function normalizeYears(from: number | null, to: number | null): Pick<ResearchFilters, "yearFrom" | "yearTo"> {
  const valid = (year: number | null) =>
    year !== null && Number.isInteger(year) && year >= MODEL_YEAR_BOUNDS.min && year <= MODEL_YEAR_BOUNDS.max
      ? year
      : null;
  const [a, b] = [valid(from), valid(to)];
  return a !== null && b !== null && a > b ? { yearFrom: b, yearTo: a } : { yearFrom: a, yearTo: b };
}

/**
 * Comparação já pronta para o filtro: o outro modelo só vale com um modelo escolhido e o outro estado só se difere do
 * estado dos filtros; igual ao principal não compara nada, e sem diferença nenhuma não há comparação.
 */
export function normalizeComparison(
  filters: Pick<ResearchFilters, "vehicle" | "state">,
  compare: ResearchComparison | null,
): ResearchComparison | null {
  if (compare === null) return null;
  const sameVehicle =
    compare.vehicle !== null &&
    filters.vehicle !== null &&
    compare.vehicle.brand === filters.vehicle.brand &&
    compare.vehicle.model === filters.vehicle.model;
  const vehicle = filters.vehicle === null || sameVehicle ? null : compare.vehicle;
  const state = compare.state === filters.state ? null : compare.state;
  return vehicle === null && state === null ? null : { vehicle, state };
}

/** Os dois grupos da comparação como filtros completos (o segundo herda o que a comparação não troca). */
export function comparisonGroups(filters: ResearchFilters): [ResearchFilters, ResearchFilters] | null {
  const { compare } = filters;
  if (compare === null) return null;
  const first: ResearchFilters = { ...filters, compare: null };
  return [first, { ...first, vehicle: compare.vehicle ?? filters.vehicle, state: compare.state ?? filters.state }];
}

/** Nome de um grupo da comparação: "Chevrolet Onix · São Paulo", "Hyundai HB20", "Brasil". */
export function groupLabel({ vehicle, state }: Pick<ResearchFilters, "vehicle" | "state">): string {
  const parts = [vehicle === null ? null : vehicleLabel(vehicle), state === null ? null : STATE_NAMES[state]];
  return parts.filter((part) => part !== null).join(" · ") || "Brasil";
}

/** Padrão medido em 08/10/2026: carros sem monta declarada são 737 das 1.231 vendas com valor de mercado. */
export const DEFAULT_RESEARCH_FILTERS: ResearchFilters = {
  category: "carros",
  condition: "sem-monta",
  vehicle: null,
  state: null,
  yearFrom: null,
  yearTo: null,
  source: null,
  maxKm: null,
  compare: null,
  metric: "ratio",
  period: null,
  sale: null,
};

/**
 * Marca e modelo digitados ou vindos da URL, na forma em que a Pesquisa agrupa: "Chevrolet" + "Onix Plus" vira
 * CHEVROLET + ONIX. Sem marca ou modelo reconhecível: `null`.
 */
export function researchVehicle(brand: string, model: string): ResearchVehicle | null {
  const key = vehicleKey(brand, model);
  if (key === null) return null;
  const [normalizedBrand = "", normalizedModel = ""] = key.split("|");
  return { brand: normalizedBrand, model: normalizedModel };
}

/** Lance em R$ só compara dentro de um modelo; sem modelo, a medida volta a ser o % do valor de mercado. */
export function effectiveMetric(filters: Pick<ResearchFilters, "metric" | "vehicle">): ResearchMetric {
  return filters.vehicle === null ? "ratio" : filters.metric;
}

/** Marcas que se escrevem em sigla. As outras palavras só de letras ganham inicial maiúscula. */
const ACRONYM_BRANDS = new Set(["BMW", "BYD", "GWM", "JAC", "MG", "RAM"]);

/**
 * Nome para a tela a partir da chave normalizada: "CHEVROLET" + "ONIX" vira "Chevrolet Onix". Palavras com
 * número ("HB20", "207"), de até duas letras ("HR-V") e siglas de marca ficam em maiúsculas; o hífen separa palavras
 * ("T-CROSS" vira "T-Cross").
 */
export function vehicleLabel({ brand, model }: ResearchVehicle): string {
  const word = (text: string, acronyms: ReadonlySet<string>) =>
    /^[A-Z]{3,}$/.test(text) && !acronyms.has(text) ? `${text.charAt(0)}${text.slice(1).toLowerCase()}` : text;
  const brandLabel = brand
    .split(" ")
    .map((part) => word(part, ACRONYM_BRANDS))
    .join(" ");
  const modelLabel = model
    .split("-")
    .map((part) => word(part, new Set()))
    .join("-");
  return `${brandLabel} ${modelLabel}`;
}
