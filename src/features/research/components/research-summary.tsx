import { DataList, Skeleton, Stat } from "@/components/ui";
import { cents } from "@/domain/money";
import { type ResearchFilters, vehicleLabel } from "@/domain/research/filters";
import { formatBRL, formatRatio } from "@/lib/format";

import { belowMarketLabel, CONDITION_LABELS, salesLabel, summaryDetail, yearRangeLabel } from "../labels";
import { getBidCurve, getConditionDistribution, getPriceSummary } from "../queries";

/** Marca da curva de lance usada na leitura "ainda sobe": a véspera do fim. */
const RISE_MARK_HOURS = 24;

/**
 * Resumo no topo (D-45): a resposta da condição do filtro antes dos gráficos — mediana e faixa do meio do % do valor
 * de mercado, a amostra e, com modelo escolhido, o lance final em R$ e quanto o lance ainda sobe na véspera. Sem
 * mediana (menos de 5 vendas), diz quantas faltam em vez de mostrar um número.
 */
export async function ResearchSummary({ filters }: { filters: ResearchFilters }) {
  const [{ rows }, bidCurve, price] = await Promise.all([
    getConditionDistribution(filters),
    getBidCurve(filters),
    filters.vehicle === null ? Promise.resolve(null) : getPriceSummary(filters),
  ]);
  const selected = rows.find((row) => row.condition === filters.condition)?.summary;
  if (selected === undefined || selected.kind === "none") return null;

  const rise = bidCurve.points.find((point) => point.hours === RISE_MARK_HOURS)?.summary;
  const scope = [
    filters.vehicle === null ? null : vehicleLabel(filters.vehicle),
    yearRangeLabel(filters),
    CONDITION_LABELS[filters.condition],
  ]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <section aria-label="Resumo" className="grid gap-3">
      <p className="text-label text-muted">Resumo das vendas · {scope}</p>
      <DataList className="gap-x-8 gap-y-5 border-b-0 sm:grid-cols-2 lg:grid-cols-4">
        {selected.kind === "summary" ? (
          <Stat
            label="Mediana do % do valor de mercado"
            size="heading-2"
            note={`${belowMarketLabel(selected.median)} · faixa do meio ${formatRatio(selected.low)} a ${formatRatio(selected.high)}`}
          >
            {formatRatio(selected.median)}
          </Stat>
        ) : (
          <Stat
            label="Mediana do % do valor de mercado"
            size="heading-3"
            note="Menos vendas que o mínimo para uma mediana."
          >
            {summaryDetail(selected)}
          </Stat>
        )}
        <Stat label="Vendas com valor de mercado" size="heading-2" note="Base da mediana ao lado.">
          {selected.n.toLocaleString("pt-BR")}
        </Stat>
        {price?.kind === "summary" ? (
          <Stat
            label="Lance final mediano"
            size="heading-2"
            note={`Faixa do meio ${formatBRL(cents(Math.round(price.low)))} a ${formatBRL(cents(Math.round(price.high)))} · ${salesLabel(price.n)}`}
          >
            {formatBRL(cents(Math.round(price.median)))}
          </Stat>
        ) : null}
        {rise === undefined ? null : (
          <Stat
            label={`Ainda sobe depois de ${RISE_MARK_HOURS} h antes do fim`}
            size="heading-2"
            note={`Mediana de ${salesLabel(rise.n)} com lances observados.`}
          >
            {`+${formatRatio(1 / rise.median - 1)}`}
          </Stat>
        )}
      </DataList>
    </section>
  );
}

export function ResearchSummarySkeleton() {
  return (
    <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="hidden h-20 lg:block" />
    </div>
  );
}
