import brazil from "@svg-maps/brazil";

import type { StateCode } from "@/domain/research/states";

/**
 * Contorno dos estados (D-45): `@svg-maps/brazil`, de Victor Cazanave, sob CC BY 4.0 (o crédito aparece sob o mapa).
 * O desenho original tem 613 × 639; a área vai até 720 de largura para os rótulos com linha guia à direita.
 */
export const BRAZIL_VIEWBOX = { width: 720, height: 639 } as const;

export const BRAZIL_MAP_CREDIT = "Contorno dos estados: svg-maps, de Victor Cazanave (CC BY 4.0).";

type Point = { x: number; y: number };

/**
 * Onde escrever o rótulo de cada estado, nas coordenadas do desenho. Estados pequenos demais para o rótulo ganham
 * `callout`: o rótulo fica fora, numa linha, ligado ao estado por uma linha guia. Com `codeInside`, o estado sem venda
 * ainda mostra a sigla dentro dele (só o valor não cabe).
 */
type LabelSpec = Point & { callout?: Point; codeInside?: true };

const LABELS = {
  AC: { x: 55, y: 227 },
  AL: { x: 584, y: 232, callout: { x: 628, y: 250 } },
  AP: { x: 344, y: 66 },
  AM: { x: 145, y: 147 },
  BA: { x: 508, y: 256 },
  CE: { x: 538, y: 160, callout: { x: 556, y: 100 }, codeInside: true },
  DF: { x: 409, y: 330, callout: { x: 436, y: 306 } },
  ES: { x: 521, y: 392, callout: { x: 556, y: 404 } },
  GO: { x: 370, y: 350 },
  MA: { x: 448, y: 165 },
  MT: { x: 283, y: 285 },
  MS: { x: 299, y: 405 },
  MG: { x: 458, y: 378 },
  PA: { x: 324, y: 147 },
  PB: { x: 586, y: 193, callout: { x: 628, y: 180 } },
  PR: { x: 350, y: 477 },
  PE: { x: 560, y: 212, callout: { x: 628, y: 215 } },
  PI: { x: 487, y: 208 },
  RJ: { x: 490, y: 438, callout: { x: 528, y: 466 } },
  RN: { x: 585, y: 172, callout: { x: 628, y: 145 } },
  RS: { x: 323, y: 566 },
  RO: { x: 174, y: 253 },
  RR: { x: 197, y: 50 },
  SC: { x: 362, y: 524, callout: { x: 410, y: 536 }, codeInside: true },
  SP: { x: 388, y: 426 },
  SE: { x: 571, y: 248, callout: { x: 628, y: 285 } },
  TO: { x: 399, y: 260 },
} as const satisfies Record<StateCode, LabelSpec>;

function isMapState(code: string): code is StateCode {
  return code in LABELS;
}

export type StateShape = { state: StateCode; path: string; label: LabelSpec };

export const STATE_SHAPES: readonly StateShape[] = brazil.locations.flatMap(({ id, path }) => {
  const state = id.toUpperCase();
  return isMapState(state) ? [{ state, path, label: LABELS[state] }] : [];
});
