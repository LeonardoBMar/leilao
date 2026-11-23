import { ChartDataTable } from "@/components/charts/chart-data-table";
import { StepLine } from "@/components/charts/step-line";
import { lotBidRiseRatio, type LotBidStep, lotBidTimeAxis, MIN_LOT_BID_STEPS } from "@/domain/lots/bid-history";
import { type Cents, cents } from "@/domain/money";
import { niceRange } from "@/lib/charts";
import {
  formatBRL,
  formatCompactBRL,
  formatCompactDateTime,
  formatDate,
  formatDateTime,
  formatRatio,
  formatTime,
} from "@/lib/format";

type LotBidHistoryProps = {
  steps: readonly LotBidStep[];
  lastCheckedAt: Date;
  /** Limite fixado viável do lote, desenhado como linha tracejada de referência quando cabe na escala. */
  maxBid: Cents | null;
};

/**
 * Evolução de lances do anúncio ligado ao lote (D-87): reaproveita `StepLine` sobre `listing_observations` e exibe
 * a linha tracejada do limite fixado para o usuário enxergar o ritmo de subida frente ao seu teto.
 */
export function LotBidHistory({ steps, lastCheckedAt, maxBid }: LotBidHistoryProps) {
  if (steps.length < MIN_LOT_BID_STEPS) return null;

  const first = steps[0];
  const last = steps.at(-1);
  if (!first || !last) return null;

  const values = steps.map((step) => step.bid);
  const low = Math.min(...values);
  const top = Math.max(...values);
  // Só inclui a linha do limite se estiver numa escala compatível, para não esmagar a curva de lances.
  const showLimit = maxBid !== null && maxBid <= top * 1.6 && maxBid >= low * 0.5;
  const rangeLow = showLimit && maxBid !== null ? Math.min(low, maxBid) : low;
  const rangeHigh = showLimit && maxBid !== null ? Math.max(top, maxBid) : top;
  const { domain: yDomain, ticks: yTicks } = niceRange(rangeLow, rangeHigh);

  const { xDomain, tickTimes } = lotBidTimeAxis(steps, lastCheckedAt, 4);
  const sameDay = formatDate(new Date(xDomain[0])) === formatDate(new Date(xDomain[1]));
  const formatTick = (ms: number) => (sameDay ? formatTime(new Date(ms)) : formatCompactDateTime(new Date(ms)));
  const rise = lotBidRiseRatio(steps);

  return (
    <div className="grid gap-3 border-t border-border-strong pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-label font-medium text-foreground">Evolução dos lances</p>
        <p className="text-caption text-muted tabular-nums">
          {rise !== null
            ? `${rise > 0 ? "Subiu" : "Variou"} ${formatRatio(Math.abs(rise))} desde ${formatBRL(first.bid)}`
            : `${steps.length} variações vistas pelo coletor`}
        </p>
      </div>

      <StepLine
        ariaLabel={`Evolução dos lances: ${steps.map((step) => `${formatBRL(step.bid)} em ${formatDateTime(step.observedAt)}`).join("; ")}.`}
        xDomain={xDomain}
        xTicks={tickTimes.map((value) => ({ value, label: formatTick(value) }))}
        yDomain={yDomain}
        yTicks={yTicks.map((value) => ({ value, label: formatCompactBRL(cents(Math.round(value))) }))}
        reference={
          showLimit && maxBid !== null ? { value: maxBid, label: `Meu limite ${formatCompactBRL(maxBid)}` } : undefined
        }
        endLabel={formatCompactBRL(last.bid)}
        points={steps.map((step, index) => ({
          key: `${step.observedAt.getTime()}-${index}`,
          x: step.observedAt.getTime(),
          y: step.bid,
          title: `${formatBRL(step.bid)} em ${formatDateTime(step.observedAt)}`,
        }))}
      />

      <p className="text-caption text-muted">
        {steps.length} lances vistos pelo coletor. Entre duas visitas, o lance pode ter mudado sem registro.
      </p>

      <ChartDataTable
        summary="Ver lances em tabela"
        columns={[
          { key: "when", label: "Data e hora" },
          { key: "bid", label: "Lance", align: "right" },
          { key: "delta", label: "Variação", align: "right" },
        ]}
        rows={steps.map((step, index) => {
          const previous = index > 0 ? steps[index - 1] : undefined;
          const diff = previous ? step.bid - previous.bid : null;
          return {
            key: `${step.observedAt.getTime()}-${index}`,
            when: formatDateTime(step.observedAt),
            bid: formatBRL(step.bid),
            delta: diff === null ? "Primeiro visto" : `${diff >= 0 ? "+ " : "− "}${formatBRL(cents(Math.abs(diff)))}`,
          };
        })}
      />
    </div>
  );
}
