import type { ListingCriteria } from "@/domain/listings/criteria";

/**
 * Controles dos critérios comuns (docs/PLANO-FILTROS.md §2), usados na barra de filtros, na gaveta e no formulário do
 * monitor. Cada um recebe os critérios atuais e devolve só o que mudou; quem usa decide se aplica na hora (barra) ou
 * guarda no formulário (monitor).
 */
export type CriteriaControlProps = {
  criteria: ListingCriteria;
  onChange: (patch: Partial<ListingCriteria>) => void;
};

export const ANY_OPTION = "qualquer";
