import type { Route } from "next";

import { DEFAULT_EVALUATE_FILTERS } from "@/domain/research/evaluate";
import { type ResearchFilters, type ResearchVehicle, vehicleLabel } from "@/domain/research/filters";
import {
  AGE_BAND_LIMITS,
  AGE_BANDS,
  type AgeBand,
  MIN_SAMPLE,
  type RankedModel,
  ratioAxisMax,
} from "@/domain/research/summary";
import { niceTicks } from "@/lib/charts";
import { formatRatio } from "@/lib/format";

import { getConditionDistribution, getModelRanking } from "../queries";
import type { RankingModel, RankingRow, RankingStats } from "../ranking-view";
import { evaluateHref } from "../search";
import { RankingExplorer } from "./ranking-explorer";
import { ResearchBlock } from "./research-block";

export const RANKING_BLOCK_TITLE = "Modelos";

type Group = Pick<RankedModel, "summary" | "context">;

/** Anos-modelo de uma faixa de idade, contados a partir do ano corrente, para o Avaliar abrir no mesmo recorte. */
function yearsOfAge(age: AgeBand, year: number): { yearFrom: number | null; yearTo: number | null } {
  if (age === "ate5") return { yearFrom: year - AGE_BAND_LIMITS.ate5, yearTo: null };
  if (age === "6a10") return { yearFrom: year - AGE_BAND_LIMITS["6a10"], yearTo: year - AGE_BAND_LIMITS.ate5 - 1 };
  return { yearFrom: null, yearTo: year - AGE_BAND_LIMITS["6a10"] - 1 };
}

function statsOf({ summary, context }: Group, weeks: number): RankingStats {
  return {
    n: summary.n,
    low: summary.low,
    median: summary.median,
    high: summary.high,
    year: context.medianYear,
    bid: context.medianBid,
    perWeek: summary.n / weeks,
  };
}

/**
 * Ranking dos modelos (D-45), só sem modelo escolhido: mediana e faixa do meio do % da FIPE de cada modelo com a
 * amostra mínima, frente à mediana de todos os modelos, com o ano e o lance medianos e as vendas por semana; os
 * grupos por idade na venda vão junto para o filtro de idade. Cada linha abre o modelo no Avaliar (D-71), na mesma
 * condição e, com idade escolhida, nos mesmos anos-modelo: lá estão a faixa em R$, as vendas e os lotes abertos.
 */
export async function RankingBlock({ filters }: { filters: ResearchFilters }) {
  const [ranking, { rows: conditions }] = await Promise.all([
    getModelRanking(filters),
    getConditionDistribution(filters),
  ]);
  const overall = conditions.find((row) => row.condition === filters.condition)?.summary;
  const year = new Date().getUTCFullYear();
  const href = (vehicle: ResearchVehicle, years: { yearFrom: number | null; yearTo: number | null }): Route =>
    evaluateHref({ ...DEFAULT_EVALUATE_FILTERS, vehicle, condition: filters.condition, ...years });
  const rows: RankingModel<RankingRow & { href: Route }>[] = ranking.models.map((model) => {
    const vehicle = { brand: model.brand, model: model.model };
    return {
      ...vehicle,
      label: vehicleLabel(vehicle),
      ...statsOf(model, ranking.weeks),
      href: href(vehicle, { yearFrom: null, yearTo: null }),
      byAge: Object.fromEntries(
        AGE_BANDS.flatMap((age) => {
          const group = model.byAge[age];
          return group === undefined
            ? []
            : [[age, { ...statsOf(group, ranking.weeks), href: href(vehicle, yearsOfAge(age, year)) }] as const];
        }),
      ),
    };
  });
  const axisMax = ratioAxisMax(
    Math.max(0, ...rows.flatMap((row) => [row.high, ...Object.values(row.byAge).map((group) => group.high)])),
  );

  return (
    <ResearchBlock
      id="pesquisa-modelos"
      title={RANKING_BLOCK_TITLE}
      description={`% da FIPE pago por modelo (${MIN_SAMPLE} vendas ou mais).`}
    >
      {rows.length === 0 ? (
        <p className="text-body text-muted">
          Nenhum modelo tem {MIN_SAMPLE} vendas ou mais com esses filtros. Busque um modelo para ver as vendas dele.
        </p>
      ) : (
        <RankingExplorer
          rows={rows}
          axisMax={axisMax}
          overall={overall?.kind === "summary" ? overall.median : null}
          ticks={niceTicks(axisMax)
            .filter((tick) => tick <= axisMax)
            .map((value) => ({ value, label: formatRatio(value) }))}
        />
      )}
    </ResearchBlock>
  );
}
