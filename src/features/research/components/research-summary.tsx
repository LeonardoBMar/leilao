import type { ReactNode } from "react";

import { Card, Skeleton } from "@/components/ui";
import { cents } from "@/domain/money";
import { type ResearchFilters, vehicleLabel } from "@/domain/research/filters";
import { isSmallSample } from "@/domain/research/summary";
import { formatCompactBRL, formatRatio } from "@/lib/format";

import {
  belowMarketLabel,
  CONDITION_LABELS,
  excludedLabel,
  riseLabel,
  salesLabel,
  summaryDetail,
  yearRangeLabel,
} from "../labels";
import { getBidCurve, getConditionDistribution, getExcludedSales, getPriceSummary } from "../queries";

/** Marca da curva de lance usada na leitura "ainda sobe": a véspera do fim. */
const RISE_MARK_HOURS = 24;

const compact = (value: number) => formatCompactBRL(cents(Math.round(value)));

/**
 * Resumo no topo (D-45): a resposta da condição do filtro antes dos gráficos, em cartões — mediana do % do valor de
 * mercado, a amostra e, com modelo escolhido, o lance final mediano e quanto o lance sobe na véspera. Sem mediana
 * (menos de 5 vendas), diz quantas faltam; sem nenhuma venda com valor de mercado, fica só o lance em R$.
 */
export async function ResearchSummary({ filters }: { filters: ResearchFilters }) {
  const [{ rows }, bidCurve, excluded, price] = await Promise.all([
    getConditionDistribution(filters),
    getBidCurve(filters),
    getExcludedSales(filters),
    filters.vehicle === null ? Promise.resolve(null) : getPriceSummary(filters),
  ]);
  const found = rows.find((row) => row.condition === filters.condition)?.summary;
  const ratio = found === undefined || found.kind === "none" ? null : found;
  const priceSummary = price?.kind === "summary" ? price : null;
  if (ratio === null && priceSummary === null) return null;

  const outside = excludedLabel(excluded);
  const rise = bidCurve.points.find((point) => point.hours === RISE_MARK_HOURS)?.summary;
  const scope = [
    filters.vehicle === null ? null : vehicleLabel(filters.vehicle),
    yearRangeLabel(filters),
    CONDITION_LABELS[filters.condition],
  ]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <section aria-label="Resumo" className="grid gap-2">
      <p className="text-label text-muted">{scope}</p>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
        {ratio === null ? null : ratio.kind === "summary" ? (
          <Tile
            label="Mediana do % do mercado"
            note={`${belowMarketLabel(ratio.median)}. Metade entre ${formatRatio(ratio.low)} e ${formatRatio(ratio.high)}.`}
          >
            {formatRatio(ratio.median)}
          </Tile>
        ) : (
          <Tile label="Mediana do % do mercado" note="Poucas vendas para uma mediana.">
            <span className="text-heading-3">{summaryDetail(ratio)}</span>
          </Tile>
        )}
        {ratio === null ? null : (
          <Tile
            label="Vendas no %"
            note={[isSmallSample(ratio.n) ? "Amostra pequena." : null, outside === null ? null : `Fora: ${outside}.`]
              .filter((part) => part !== null)
              .join(" ")}
          >
            {ratio.n.toLocaleString("pt-BR")}
          </Tile>
        )}
        {priceSummary === null ? null : (
          <Tile
            label="Lance final mediano"
            note={`Metade entre ${compact(priceSummary.low)} e ${compact(priceSummary.high)}.`}
          >
            {compact(priceSummary.median)}
          </Tile>
        )}
        {rise === undefined ? null : (
          <Tile label={`Sobe nas últimas ${RISE_MARK_HOURS} h`} note={`Mediana de ${salesLabel(rise.n)}.`}>
            {riseLabel(rise.median)}
          </Tile>
        )}
      </dl>
    </section>
  );
}

function Tile({ label, note, children }: { label: string; note: string; children: ReactNode }) {
  return (
    <Card variant="metric" className="grid content-start gap-1 p-4">
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="text-heading-2 text-foreground tabular-nums">{children}</dd>
      {note ? <dd className="text-caption text-muted">{note}</dd> : null}
    </Card>
  );
}

export function ResearchSummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Skeleton className="h-28 rounded-lg" />
      <Skeleton className="h-28 rounded-lg" />
      <Skeleton className="hidden h-28 rounded-lg lg:block" />
    </div>
  );
}
