import { type ResearchFilters, vehicleLabel } from "@/domain/research/filters";
import { MIN_SAMPLE, ratioAxisMax } from "@/domain/research/summary";
import { niceTicks } from "@/lib/charts";
import { formatRatio } from "@/lib/format";

import { getConditionDistribution, getModelRanking } from "../queries";
import { researchHref } from "../search";
import { RankingExplorer } from "./ranking-explorer";
import { ResearchBlock } from "./research-block";

export const RANKING_BLOCK_TITLE = "Modelos";

/**
 * Ranking dos modelos (D-45), só sem modelo escolhido: mediana e faixa do meio do % do valor de mercado de cada modelo
 * com a amostra mínima, frente à mediana de todos os modelos. Cada linha aplica o filtro do modelo.
 */
export async function RankingBlock({ filters }: { filters: ResearchFilters }) {
  const [ranking, { rows: conditions }] = await Promise.all([
    getModelRanking(filters),
    getConditionDistribution(filters),
  ]);
  const overall = conditions.find((row) => row.condition === filters.condition)?.summary;
  const rows = ranking.map(({ brand, model, summary }) => ({
    brand,
    model,
    label: vehicleLabel({ brand, model }),
    n: summary.n,
    low: summary.low,
    median: summary.median,
    high: summary.high,
    // Outro modelo é outro recorte: a faixa de ano e a venda aberta não valem para ele.
    href: researchHref({ ...filters, vehicle: { brand, model }, yearFrom: null, yearTo: null, sale: null }),
  }));
  const axisMax = ratioAxisMax(Math.max(0, ...rows.map((row) => row.high)));

  return (
    <ResearchBlock
      id="pesquisa-modelos"
      title={RANKING_BLOCK_TITLE}
      description={`% do valor de mercado pago por modelo (${MIN_SAMPLE} vendas ou mais).`}
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
