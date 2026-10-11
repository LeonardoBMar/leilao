import type { EstimateSale, EstimateTarget, PriceEstimate } from "./estimates";

/**
 * Backtest do preço provável (docs/PLANO-MERCADO.md, T0.1). Puro.
 *
 * Cada venda é estimada só com as vendas que encerraram **antes do dia dela** (e dentro da janela), como se o usuário
 * a visse na véspera. O estimador é montado uma vez por dia, porque o índice de vendas é caro e muda pouco num dia.
 * O resultado diz quantas vendas tiveram estimativa, quantas caíram dentro da faixa (feita para conter metade delas,
 * `bandOf`) e o erro mediano da mediana estimada.
 */

export type BacktestSale = EstimateSale & EstimateTarget;

/** Estimador montado a partir das vendas anteriores (ex.: `buildEstimateIndex` + `estimatePrice`). */
export type MakeEstimator<S extends BacktestSale> = (prior: readonly S[]) => (target: S) => PriceEstimate;

export type BacktestOutcome<S extends BacktestSale = BacktestSale> = { sale: S; estimate: PriceEstimate };

const DAY_MS = 24 * 60 * 60 * 1000;

const dayOf = (date: Date) => Math.floor(date.getTime() / DAY_MS);

/**
 * Estima cada venda com encerramento em `from` ou depois. `sales` em qualquer ordem; `windowMs` limita a idade das
 * vendas anteriores, como `SALES_WINDOW_MS` nas telas.
 */
export function runBacktest<S extends BacktestSale>(
  sales: readonly S[],
  makeEstimator: MakeEstimator<S>,
  options: { from: Date; windowMs: number },
): BacktestOutcome<S>[] {
  const sorted = sales.toSorted((a, b) => a.endsAt.getTime() - b.endsAt.getTime());
  const byDay = new Map<number, S[]>();
  for (const sale of sorted) {
    if (sale.endsAt < options.from) continue;
    pushTo(byDay, dayOf(sale.endsAt), sale);
  }

  const outcomes: BacktestOutcome<S>[] = [];
  for (const [day, targets] of byDay) {
    const start = day * DAY_MS;
    const prior = sorted.filter(
      (sale) => sale.endsAt.getTime() < start && sale.endsAt.getTime() >= start - options.windowMs,
    );
    const estimate = makeEstimator(prior);
    for (const sale of targets) outcomes.push({ sale, estimate: estimate(sale) });
  }
  return outcomes;
}

export type BacktestSummary = {
  /** Vendas estimadas (alvos do backtest). */
  total: number;
  /** Vendas com preço provável (comparáveis ou proporção). */
  estimated: number;
  /** Parte das estimadas com o lance final dentro da faixa do preço provável. */
  hitRate: number | null;
  /** Mediana de |mediana estimada − lance final| ÷ lance final. */
  medianAbsError: number | null;
};

export function summarizeBacktest(outcomes: readonly BacktestOutcome[]): BacktestSummary {
  const errors: number[] = [];
  let hits = 0;
  for (const { sale, estimate } of outcomes) {
    if (estimate.kind === "insufficient") continue;
    if (sale.finalBid >= estimate.low && sale.finalBid <= estimate.high) hits += 1;
    errors.push(Math.abs(estimate.median - sale.finalBid) / sale.finalBid);
  }
  errors.sort((a, b) => a - b);
  return {
    total: outcomes.length,
    estimated: errors.length,
    hitRate: errors.length === 0 ? null : hits / errors.length,
    medianAbsError: errors.length === 0 ? null : medianOfSorted(errors),
  };
}

/** O resumo por grupo (método, nível, categoria…), na ordem em que cada grupo aparece pela primeira vez. */
export function summarizeBacktestBy<S extends BacktestSale>(
  outcomes: readonly BacktestOutcome<S>[],
  groupOf: (outcome: BacktestOutcome<S>) => string,
): Map<string, BacktestSummary> {
  const groups = new Map<string, BacktestOutcome<S>[]>();
  for (const outcome of outcomes) {
    pushTo(groups, groupOf(outcome), outcome);
  }
  return new Map([...groups].map(([key, items]) => [key, summarizeBacktest(items)]));
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

function medianOfSorted(sorted: readonly number[]): number {
  const middle = (sorted.length - 1) / 2;
  const a = sorted[Math.floor(middle)] ?? 0;
  const b = sorted[Math.ceil(middle)] ?? a;
  return (a + b) / 2;
}
