import type { ConditionKey } from "@/domain/listings/criteria";
import { type ResearchCondition, type ResearchFilters, vehicleLabel } from "@/domain/research/filters";

/**
 * Condição do catálogo mais próxima de cada condição da Pesquisa. O catálogo filtra "até" (cumulativo) e a Pesquisa
 * olha uma condição só, então fora de "sem monta" a correspondência é aproximada: o catálogo mostra o filtro aplicado.
 * Sucata não está em nenhuma condição do catálogo (`com-monta` vai só até grande monta), então fica sem filtro de
 * condição, em vez de mostrar lotes que não são sucata.
 */
const CATALOG_CONDITION = {
  "sem-monta": "sem-monta",
  pequena: "ate-pequena",
  media: "ate-media",
  grande: "com-monta",
  sucata: "qualquer",
} as const satisfies Record<ResearchCondition, ConditionKey>;

/**
 * Parâmetros do catálogo de lotes (`/leiloes/veiculos`) para os lotes abertos do modelo escolhido, com a categoria, a
 * condição, a faixa de ano, o km e a fonte da Pesquisa, em qualquer distância. Sem modelo escolhido, `null`: a busca
 * ficaria sem assunto. O estado não vai, porque o catálogo filtra por distância e não por UF.
 */
export function catalogParams(filters: ResearchFilters): Record<string, string> | null {
  if (filters.vehicle === null) return null;
  const params: Record<string, string | undefined> = {
    busca: vehicleLabel(filters.vehicle),
    categoria: filters.category,
    condicao: CATALOG_CONDITION[filters.condition],
    anoDe: filters.yearFrom?.toString(),
    anoAte: filters.yearTo?.toString(),
    kmAte: filters.maxKm?.toString(),
    fonte: filters.source ?? undefined,
    distancia: "todas",
  };
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])),
  );
}
