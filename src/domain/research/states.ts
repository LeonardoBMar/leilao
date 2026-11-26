import { isStateCode, STATE_CODES, STATE_NAMES, type StateCode } from "./state-codes";
import { type GroupStats, type GroupSummary, summarize } from "./summary";

/** Estados do mapa da Pesquisa (docs/PLANO-PESQUISA.md §4, D-45). */

export { isStateCode, STATE_CODES, STATE_NAMES, type StateCode };

export type StateSummary = { state: StateCode; summary: GroupSummary };

/**
 * Os 27 estados com o resumo de cada um. Estado ausente das estatísticas fica `none`; com 1 a 4 vendas, `few` (só a
 * contagem, sem cor).
 */
export function buildStateSummaries(byState: Readonly<Partial<Record<StateCode, GroupStats>>>): StateSummary[] {
  return STATE_CODES.map((state) => ({ state, summary: summarize(byState[state]) }));
}
