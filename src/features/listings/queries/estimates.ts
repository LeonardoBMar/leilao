import "server-only";

import { cache } from "react";

import {
  type AnalysisSample,
  buildEstimateIndex,
  type EstimateIndex,
  SALES_WINDOW_MS,
} from "@/domain/listings/estimates";
import { analysisColumns, toInputs } from "@/features/analyses/queries";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { loadRecentSales } from "@/server/market/sold-sales";

/**
 * Base das estimativas (etapa 5, D-36): vendas do catálogo no último ano e a análise fixada mais recente de cada lote
 * do usuário. As vendas vêm do cache do catálogo (D-78); as análises, do banco a cada tela.
 */
export type EstimateContext = { index: EstimateIndex; analyses: AnalysisSample[]; now: Date };

export async function loadEstimateContext(now: Date): Promise<EstimateContext> {
  const user = await requireUser();
  const [sales, lots] = await Promise.all([
    loadRecentSales(),
    db.lot.findMany({
      where: { ownerId: user.id, analyses: { some: { status: "fixed" } } },
      select: {
        brand: true,
        model: true,
        modelYear: true,
        analyses: { where: { status: "fixed" }, orderBy: { version: "desc" }, take: 1, select: analysisColumns },
      },
    }),
  ]);

  return {
    // O cache pode ter alguns minutos: a janela é refeita contra `now`.
    index: buildEstimateIndex(sales.filter((sale) => sale.endsAt.getTime() >= now.getTime() - SALES_WINDOW_MS)),
    analyses: lots.flatMap(({ analyses, ...lot }) =>
      analyses.map((analysis) => ({ ...lot, inputs: toInputs(analysis) })),
    ),
    now,
  };
}

/**
 * A mesma base, uma vez por requisição (memo do `React.cache`, como `getCurrentUser`; D-44): cabeçalho e blocos do
 * dashboard leem as estimativas sem recarregar as vendas. Não guarda nada entre requisições (D-04).
 */
export const getEstimateContext = cache(async (): Promise<EstimateContext> => {
  await requireUser();
  return loadEstimateContext(new Date());
});
