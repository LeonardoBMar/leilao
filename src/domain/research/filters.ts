import type { DamageLevel } from "../listings/condition";
import type { CategoryKey } from "../listings/criteria";
import { vehicleKey } from "../listings/estimates";
import type { StateCode } from "./tile-map";

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

export type ResearchFilters = {
  category: ResearchCategory;
  condition: ResearchCondition;
  vehicle: ResearchVehicle | null;
  state: StateCode | null;
  metric: ResearchMetric;
};

/** Padrão medido em 08/10/2026: carros sem monta declarada são 737 das 1.231 vendas com valor de mercado. */
export const DEFAULT_RESEARCH_FILTERS: ResearchFilters = {
  category: "carros",
  condition: "sem-monta",
  vehicle: null,
  state: null,
  metric: "ratio",
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
