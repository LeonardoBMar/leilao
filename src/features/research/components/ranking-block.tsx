import Link from "next/link";

import { ChartDataTable } from "@/components/charts/chart-data-table";
import { RangeBars } from "@/components/charts/range-bars";
import { type ResearchFilters, vehicleLabel } from "@/domain/research/filters";
import { isSmallSample, MIN_SAMPLE, ratioAxisMax } from "@/domain/research/summary";
import { formatRatio } from "@/lib/format";

import { smallSampleLabel } from "../labels";
import { getModelRanking } from "../queries";
import { researchHref } from "../search";
import { ResearchBlock } from "./research-block";

export const RANKING_BLOCK_TITLE = "Modelos que mais saem abaixo do valor de mercado";

/** Linhas no gráfico; a tabela traz todos. */
const RANKING_VISIBLE = 15;

/**
 * Ranking dos modelos (D-45), só sem modelo escolhido: mediana e faixa do meio do % do valor de mercado de cada modelo
 * com a amostra mínima. Cada linha aplica o filtro do modelo.
 */
export async function RankingBlock({ filters }: { filters: ResearchFilters }) {
  const ranking = await getModelRanking(filters);
  const rows = ranking.map(({ brand, model, summary }) => {
    const label = vehicleLabel({ brand, model });
    return {
      key: `${brand}|${model}`,
      label,
      low: summary.low,
      median: summary.median,
      high: summary.high,
      valueLabel: formatRatio(summary.median),
      detail: smallSampleLabel(summary.n),
      faint: isSmallSample(summary.n),
      href: researchHref({ ...filters, vehicle: { brand, model } }),
      ariaLabel: `${label}: mediana ${formatRatio(summary.median)} do valor de mercado, ${smallSampleLabel(summary.n)}`,
    };
  });
  const domain = [0, ratioAxisMax(Math.max(0, ...rows.map((row) => row.high)))] as const;

  return (
    <ResearchBlock
      id="pesquisa-modelos"
      title={RANKING_BLOCK_TITLE}
      description={`Mediana e faixa do meio do lance final em % do valor de mercado, para modelos com ${MIN_SAMPLE} vendas ou mais. Escolha um modelo para ver cada estado.`}
    >
      {rows.length === 0 ? (
        <p className="text-body text-muted">
          Nenhum modelo tem {MIN_SAMPLE} vendas ou mais com esses filtros. Busque um modelo para ver as vendas dele.
        </p>
      ) : (
        <>
          <RangeBars
            ariaLabel={`Modelos do menor para o maior % do valor de mercado: ${rows
              .slice(0, RANKING_VISIBLE)
              .map((row) => `${row.label} ${row.valueLabel}`)
              .join(", ")}`}
            domain={domain}
            rows={rows.slice(0, RANKING_VISIBLE)}
          />
          <ChartDataTable
            summary={rows.length > RANKING_VISIBLE ? `Ver os ${rows.length} modelos em tabela` : undefined}
            columns={[
              { key: "model", label: "Modelo" },
              { key: "sales", label: "Vendas", align: "right" },
              { key: "low", label: "P25", align: "right" },
              { key: "median", label: "Mediana", align: "right" },
              { key: "high", label: "P75", align: "right" },
            ]}
            rows={rows.map((row) => ({
              key: row.key,
              model: (
                <Link href={row.href} className="text-accent hover:text-accent-hover hover:underline">
                  {row.label}
                </Link>
              ),
              sales: row.detail,
              low: formatRatio(row.low),
              median: row.valueLabel,
              high: formatRatio(row.high),
            }))}
          />
        </>
      )}
    </ResearchBlock>
  );
}
