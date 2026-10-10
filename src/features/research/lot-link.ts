import type { DamageLevel } from "@/domain/listings/condition";
import { categoryKeyOf } from "@/domain/listings/criteria";
import {
  DAMAGE_OF_CONDITION,
  DEFAULT_RESEARCH_FILTERS,
  RESEARCH_CATEGORIES,
  RESEARCH_CONDITIONS,
  type ResearchFilters,
  researchVehicle,
} from "@/domain/research/filters";
import { isStateCode } from "@/domain/research/states";

/** O que se sabe de um lote para abrir a Pesquisa nas vendas parecidas. */
export type LotResearchContext = {
  brand: string;
  model: string;
  /** Do anúncio coletado ligado ao lote; lote cadastrado à mão não tem. */
  category: string | null;
  damageLevel: DamageLevel | null;
  state: string | null;
};

/**
 * Filtros da Pesquisa para as vendas parecidas com um lote: o modelo, a condição declarada, a categoria e o estado do
 * anúncio ligado. O que o lote não diz fica no padrão da Pesquisa (carros, sem monta declarada, Brasil todo), e a
 * faixa de ano fica livre para quem lê refinar.
 */
export function lotResearchFilters({
  brand,
  model,
  category,
  damageLevel,
  state,
}: LotResearchContext): ResearchFilters {
  const categoryKey = categoryKeyOf(category);
  return {
    ...DEFAULT_RESEARCH_FILTERS,
    vehicle: researchVehicle(brand, model),
    category: RESEARCH_CATEGORIES.find((key) => key === categoryKey) ?? DEFAULT_RESEARCH_FILTERS.category,
    condition:
      RESEARCH_CONDITIONS.find((condition) => DAMAGE_OF_CONDITION[condition] === damageLevel) ??
      DEFAULT_RESEARCH_FILTERS.condition,
    state: state !== null && isStateCode(state) ? state : null,
  };
}
