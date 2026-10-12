import { type ReactNode, Suspense } from "react";

import { Skeleton } from "@/components/ui";
import { type EvaluateFilters, familyLabel, targetFilters } from "@/domain/research/evaluate";

import { getEvaluateModels, getEvaluation, getLotTarget } from "../queries";
import { evaluateParams, parseEvaluateParams } from "../schemas";
import type { SearchParams } from "../search";
import type { EvaluationView, LotTarget } from "../types";
import { EvaluateAnswer } from "./evaluate-answer";
import { EVALUATE_CHART_TITLE, EvaluateChartBlock } from "./evaluate-chart-block";
import { EvaluateComparables } from "./evaluate-comparables";
import { EvaluateEntry } from "./evaluate-entry";
import { type EvaluateFacets, EvaluateFilterBar } from "./evaluate-filter-bar";
import { EvaluateOpenListings, OPEN_LISTINGS_TITLE, type OpenListingAction } from "./evaluate-open-listings";
import { ResearchBlockSkeleton } from "./research-block";
import { ResearchShell } from "./research-shell";

/** Recorte em vigor: o da URL ou, com `?lote=<id>` e sem modelo, o do lote (o mesmo do preço provável). */
async function resolveEvaluation(
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
export async function EvaluateView({
  searchParams,
  openListingAction,
  vehicleActions,
}: {
  searchParams: SearchParams;
  /** Ação de cada lote aberto, composta pela rota. */
  openListingAction: OpenListingAction;
  /** Ações do recorte (monitor, catálogo), compostas pela rota: juntam outras features. */
  vehicleActions: (filters: EvaluateFilters) => ReactNode;
}) {
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
      {evaluation === null ? (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <EvaluateEntry models={models} />
        </Suspense>
      ) : (
        <>
          <EvaluateAnswer filters={filters} evaluation={evaluation} actions={vehicleActions(filters)} />
          {evaluation.comparables.length === 0 ? null : (
            // No celular o gráfico vem depois das listas, que dizem o mesmo em texto (§5.2).
            <div className="order-last min-w-0 md:order-none">
              <Suspense fallback={<ResearchBlockSkeleton title={EVALUATE_CHART_TITLE} />}>
                <EvaluateChartBlock filters={filters} evaluation={evaluation} />
              </Suspense>
            </div>
          )}
          <Suspense fallback={<ResearchBlockSkeleton title={OPEN_LISTINGS_TITLE} className="h-32" />}>
            <EvaluateOpenListings filters={filters} evaluation={evaluation} action={openListingAction} />
          </Suspense>
          {evaluation.comparables.length === 0 ? null : (
            <EvaluateComparables filters={filters} evaluation={evaluation} />
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
