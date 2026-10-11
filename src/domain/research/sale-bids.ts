import type { Cents } from "../money";

/**
 * Lances de uma venda nas horas antes do fim (D-45): o que o coletor viu, sem ponto estimado. Puro.
 */

/** Janela do gráfico, a mesma da curva do lance (a marca mais distante é 48 h). */
export const SALE_BIDS_WINDOW_HOURS = 48;

/** Com menos lances distintos que isto (o final incluído), não há subida para mostrar. */
export const MIN_SALE_BID_STEPS = 2;

const HOUR_MS = 3_600_000;

/** Um degrau: a partir de `hoursBefore` horas antes do fim (negativo; 0 é o fim), o lance passou a ser `bid`. */
export type SaleBidStep = { hoursBefore: number; bid: Cents };

/**
 * Degraus do lance a partir das observações: só as da janela antes do fim, em ordem, e só quando o lance muda (a mesma
 * leitura repetida não é um lance novo). O lance final fecha a série no fim, se o coletor não o viu antes.
 */
export function saleBidSteps(
  observations: readonly { observedAt: Date; bid: Cents }[],
  endsAt: Date,
  finalBid: Cents,
): SaleBidStep[] {
  const start = endsAt.getTime() - SALE_BIDS_WINDOW_HOURS * HOUR_MS;
  const steps: SaleBidStep[] = [];
  for (const { observedAt, bid } of observations.toSorted((a, b) => a.observedAt.getTime() - b.observedAt.getTime())) {
    const time = observedAt.getTime();
    if (bid <= 0 || time < start || time > endsAt.getTime()) continue;
    if (steps.at(-1)?.bid === bid) continue;
    steps.push({ hoursBefore: (time - endsAt.getTime()) / HOUR_MS, bid });
  }
  if (steps.at(-1)?.bid !== finalBid) steps.push({ hoursBefore: 0, bid: finalBid });
  return steps;
}

/** Janelas do eixo, da menor para a maior: o gráfico usa a menor que cobre o primeiro lance visto. */
const SALE_BIDS_AXIS_HOURS = [3, 6, 12, 24, SALE_BIDS_WINDOW_HOURS] as const;

/** Horas antes do fim em que o eixo começa: a menor janela que mostra todos os degraus, para não espremê-los no fim. */
export function saleBidsAxisHours(steps: readonly SaleBidStep[]): number {
  const earliest = Math.max(0, ...steps.map((step) => -step.hoursBefore));
  return SALE_BIDS_AXIS_HOURS.find((hours) => hours >= earliest) ?? SALE_BIDS_WINDOW_HOURS;
}
