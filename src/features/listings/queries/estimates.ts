import "server-only";

import { cache } from "react";

import type { UserDefaultOverrides } from "@/domain/finance/defaults";
import { type AnalysisSample, type EstimateIndex } from "@/domain/listings/estimates";
import type { RegionConfig } from "@/domain/listings/region";
import { analysisColumns, toInputs } from "@/features/analyses/queries";
import { getUserPreferences } from "@/features/preferences/queries";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { getRecentEstimateIndex } from "@/server/market/sold-sales";

/**
 * Base das estimativas (etapa 5, D-36, D-85): índice de vendas do catálogo no último ano (em cache de processo por
 * 15 min), a análise fixada mais recente de cada lote do usuário e as preferências do usuário.
 */
export type EstimateContext = {
  index: EstimateIndex;
  analyses: AnalysisSample[];
  now: Date;
  region: RegionConfig;
  costOverrides: UserDefaultOverrides;
};

async function loadEstimateContext(now: Date): Promise<EstimateContext> {
  const user = await requireUser();
  const [index, lots, preferences] = await Promise.all([
    getRecentEstimateIndex(now),
    db.lot.findMany({
      where: { ownerId: user.id, analyses: { some: { status: "fixed" } } },
      select: {
        brand: true,
        model: true,
        modelYear: true,
        listing: { select: { damageLevel: true } },
        analyses: { where: { status: "fixed" }, orderBy: { version: "desc" }, take: 1, select: analysisColumns },
      },
    }),
    getUserPreferences(),
  ]);

  return {
    index,
    analyses: lots.flatMap(({ analyses, listing, ...lot }) =>
      analyses.map((analysis) => ({
        ...lot,
        ...(listing ? { damageLevel: listing.damageLevel } : {}),
        inputs: toInputs(analysis),
      })),
    ),
    now,
    region: preferences.region,
    costOverrides: preferences.costOverrides,
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
