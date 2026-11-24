import "server-only";

import { cacheLife } from "next/cache";

import { ENGINE_QUALITY_VERSION } from "@/domain/listings/engine-quality";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import { type EngineQualityData, resolveEngineQualityData } from "../engine-quality";

const ENGINE_QUALITY_HISTORY_LIMIT = 8;

/**
 * Lê o último snapshot e o histórico recente de qualidade do motor em `engine_quality_snapshots`,
 * com fallback automático para o arquivo estático `engine-quality.json` quando a tabela ainda está vazia.
 */
export async function getEngineQuality(): Promise<EngineQualityData | null> {
  await requireUser();
  return loadEngineQuality();
}

/** Igual para todos os usuários: cache do catálogo (D-78). */
async function loadEngineQuality(): Promise<EngineQualityData | null> {
  "use cache";
  cacheLife("catalog");

  const rows = await db.engineQualitySnapshot.findMany({
    where: { version: ENGINE_QUALITY_VERSION },
    orderBy: { computedAt: "desc" },
    take: ENGINE_QUALITY_HISTORY_LIMIT,
    select: { payload: true },
  });

  return resolveEngineQualityData(rows.map((row) => row.payload));
}
