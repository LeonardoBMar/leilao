import { type GroupStats, type GroupSummary, summarize } from "./summary";

/**
 * Mapa de quadrados da Pesquisa (docs/PLANO-PESQUISA.md §4, D-45): os 27 estados com o mesmo tamanho, na posição
 * aproximada do mapa. O mapa geográfico daria a tela ao AM e esconderia DF, SE e AL.
 */

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

export const TILE_GRID = { columns: 7, rows: 8 } as const;

/**
 * Posição de cada estado (coluna, linha), a partir do canto superior esquerdo:
 *
 * ```text
 * .  RR .  AP .  .  .
 * .  AM PA MA CE RN .
 * AC RO MT TO PI PB .
 * .  MS GO DF BA PE AL
 * .  .  SP MG ES SE .
 * .  .  PR RJ .  .  .
 * .  .  SC .  .  .  .
 * .  .  RS .  .  .  .
 * ```
 */
export const TILE_LAYOUT = {
  RR: { column: 1, row: 0 },
  AP: { column: 3, row: 0 },
  AM: { column: 1, row: 1 },
  PA: { column: 2, row: 1 },
  MA: { column: 3, row: 1 },
  CE: { column: 4, row: 1 },
  RN: { column: 5, row: 1 },
  AC: { column: 0, row: 2 },
  RO: { column: 1, row: 2 },
  MT: { column: 2, row: 2 },
  TO: { column: 3, row: 2 },
  PI: { column: 4, row: 2 },
  PB: { column: 5, row: 2 },
  MS: { column: 1, row: 3 },
  GO: { column: 2, row: 3 },
  DF: { column: 3, row: 3 },
  BA: { column: 4, row: 3 },
  PE: { column: 5, row: 3 },
  AL: { column: 6, row: 3 },
  SP: { column: 2, row: 4 },
  MG: { column: 3, row: 4 },
  ES: { column: 4, row: 4 },
  SE: { column: 5, row: 4 },
  PR: { column: 2, row: 5 },
  RJ: { column: 3, row: 5 },
  SC: { column: 2, row: 6 },
  RS: { column: 2, row: 7 },
} as const satisfies Record<StateCode, { column: number; row: number }>;

export type StateTile = { state: StateCode; column: number; row: number; summary: GroupSummary };

/**
 * Os 27 quadrados com o resumo de cada estado. Estado ausente das estatísticas fica `none`; com 1 a 4 vendas, `few`
 * (só a contagem, sem cor).
 */
export function buildTiles(byState: Readonly<Partial<Record<StateCode, GroupStats>>>): StateTile[] {
  return STATE_CODES.map((state) => ({ state, ...TILE_LAYOUT[state], summary: summarize(byState[state]) }));
}
