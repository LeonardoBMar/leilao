import type { DamageLevel } from "../listings/condition";
import type { CategoryKey } from "../listings/criteria";
import { vehicleKey } from "../listings/estimates";
import type { StateCode } from "./states";

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
