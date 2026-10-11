import { Suspense } from "react";

import { Skeleton } from "@/components/ui";
import { type EvaluateFilters, familyLabel, targetFilters } from "@/domain/research/evaluate";

import { getEvaluateModels, getEvaluation, getLotTarget } from "../queries";
import { evaluateParams, parseEvaluateParams } from "../schemas";
import type { SearchParams } from "../search";
import type { EvaluationView, LotTarget } from "../types";
import { EvaluateAnswer } from "./evaluate-answer";
import { EVALUATE_CHART_TITLE, EvaluateChartBlock } from "./evaluate-chart-block";
import { type EvaluateFacets, EvaluateFilterBar } from "./evaluate-filter-bar";
import { ResearchBlockSkeleton } from "./research-block";
import { ResearchShell } from "./research-shell";

/** Recorte em vigor: o da URL ou, com `?lote=<id>` e sem modelo, o do lote (o mesmo do preço provável). */
export async function resolveEvaluation(
  searchParams: SearchParams,
): Promise<{ filters: EvaluateFilters; lot: LotTarget | null }> {
  const fromUrl = parseEvaluateParams(await searchParams);
  const lot = fromUrl.lot === null ? null : await getLotTarget(fromUrl.lot);
  if (lot === null) return { filters: { ...fromUrl, lot: null }, lot: null };
  return {
    filters: fromUrl.vehicle === null ? targetFilters(lot.target, lot.id, fromUrl.excluded) : fromUrl,
    lot,
  };
}

/**
 * Avaliar (D-71, docs/PLANO-MERCADO.md §5): a busca do veículo e, com ele escolhido, a resposta, as vendas e os lotes
 * abertos do recorte. Os blocos leem o mesmo resultado (`getEvaluation` é uma vez por requisição).
 */
export async function EvaluateView({ searchParams }: { searchParams: SearchParams }) {
  const { filters, lot } = await resolveEvaluation(searchParams);
  const [models, evaluation] = await Promise.all([getEvaluateModels(), getEvaluation(filters, lot?.target ?? null)]);
  return (
    <ResearchShell
      filterBar={
        <EvaluateFilterBar
          params={evaluateParams(filters)}
          models={models}
          facets={evaluation === null ? null : facetsOf(evaluation)}
          lotLabel={lot?.label ?? null}
        />
      }
    >
      {evaluation === null ? null : (
        <>
          <EvaluateAnswer filters={filters} evaluation={evaluation} />
          {evaluation.comparables.length === 0 ? null : (
            <Suspense fallback={<ResearchBlockSkeleton title={EVALUATE_CHART_TITLE} />}>
              <EvaluateChartBlock filters={filters} evaluation={evaluation} />
            </Suspense>
          )}
        </>
      )}
    </ResearchShell>
  );
}

function facetsOf(evaluation: EvaluationView): EvaluateFacets {
  return {
    families: evaluation.families.map(({ value, n }) => ({ value, label: familyLabel(value), n })),
    versions: evaluation.versions.map(({ value, n }) => ({
      value,
      label: evaluation.versionLabels[value] ?? value,
      n,
    })),
    origins: evaluation.origins,
    conditions: evaluation.conditions,
    years: evaluation.years,
    total: evaluation.answer.n,
  };
}

export function EvaluateViewSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
