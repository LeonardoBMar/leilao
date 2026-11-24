import type { Cents } from "../money";

/**
 * Evolução de lances de um lote ligado ao catálogo (D-87): degraus reais vistos pelo coletor, sem interpolação.
 * Puro: recebe observações do anúncio e devolve a série e o domínio do eixo X para o `StepLine`.
 */

/** Mínimo de lances distintos para existir variação a exibir no gráfico. */
export const MIN_LOT_BID_STEPS = 2;

const HOUR_MS = 3_600_000;

export type LotBidStep = {
  observedAt: Date;
  bid: Cents;
};

/**
 * Converte observações brutas em degraus de lance em ordem cronológica: ignora valores não positivos e
 * leituras repetidas com o mesmo valor consecutivo.
 */
export function lotBidSteps(observations: readonly { observedAt: Date; bid: Cents }[]): LotBidStep[] {
  const steps: LotBidStep[] = [];
  for (const { observedAt, bid } of observations.toSorted((a, b) => a.observedAt.getTime() - b.observedAt.getTime())) {
    if (bid <= 0) continue;
    if (steps.at(-1)?.bid === bid) continue;
    steps.push({ observedAt, bid });
  }
  return steps;
}

/** Alta (ou queda) percentual do primeiro ao último degrau. Nula sem variação calculável. */
export function lotBidRiseRatio(steps: readonly LotBidStep[]): number | null {
  const first = steps[0];
  const last = steps.at(-1);
  if (!first || !last || steps.length < MIN_LOT_BID_STEPS || first.bid <= 0) return null;
  if (last.bid === first.bid) return null;
  return (last.bid - first.bid) / first.bid;
}

/**
 * Domínio e marcas do eixo X em milissegundos UTC. O fim do eixo acompanha a última verificação do coletor
 * (quando posterior ao último lance), mostrando que o valor permaneceu estável até ali.
 */
export function lotBidTimeAxis(
  steps: readonly LotBidStep[],
  lastCheckedAt: Date,
  tickCount = 4,
): { xDomain: readonly [number, number]; tickTimes: number[] } {
  const firstMs = steps[0]?.observedAt.getTime() ?? lastCheckedAt.getTime();
  const lastStepMs = steps.at(-1)?.observedAt.getTime() ?? firstMs;
  const rawEndMs = Math.max(lastStepMs, lastCheckedAt.getTime());
  const count = Math.max(2, tickCount);
  // Garante largura mínima suficiente para que todos os ticks arredondados tenham timestamps distintos.
  const endMs = rawEndMs - firstMs >= count - 1 ? rawEndMs : firstMs + HOUR_MS;
  const span = endMs - firstMs;
  const tickTimes = Array.from({ length: count }, (_, index) => Math.round(firstMs + (span * index) / (count - 1)));
  return { xDomain: [firstMs, endMs], tickTimes };
}
