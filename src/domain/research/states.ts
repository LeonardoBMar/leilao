import { type GroupStats, type GroupSummary, summarize } from "./summary";

/** Estados do mapa da Pesquisa (docs/PLANO-PESQUISA.md §4, D-45). */

export const STATE_CODES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;
export type StateCode = (typeof STATE_CODES)[number];

export function isStateCode(value: string): value is StateCode {
  return STATE_CODES.some((code) => code === value);
}

/** Nome por extenso, para leitores de tela ("SP" seria lido letra a letra). */
export const STATE_NAMES = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
} as const satisfies Record<StateCode, string>;

export type StateSummary = { state: StateCode; summary: GroupSummary };

/**
 * Os 27 estados com o resumo de cada um. Estado ausente das estatísticas fica `none`; com 1 a 4 vendas, `few` (só a
 * contagem, sem cor).
 */
export function buildStateSummaries(byState: Readonly<Partial<Record<StateCode, GroupStats>>>): StateSummary[] {
  return STATE_CODES.map((state) => ({ state, summary: summarize(byState[state]) }));
}
