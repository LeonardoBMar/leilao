import "server-only";

import {
  collectorRunRetentionCutoff,
  DEFAULT_RAW_PRUNE_BATCH,
  PRUNABLE_RAW_STATUSES,
  rawRetentionCutoff,
} from "@/domain/listings/retention";
import { Prisma } from "@/generated/prisma/client";

import { db } from "../db";

export type RetentionSummary = {
  /** Anúncios definitivos antigos cujo `raw` (TOAST) foi compactado para `{}`. */
  rawPruned: number;
  /** Registros antigos de `collector_runs` removidos (preservando o último de cada fonte). */
  runsDeleted: number;
};

/**
 * Manutenção periódica de armazenamento do catálogo (D-87):
 * 1. Compacta `listings.raw` para `{}` em lote limitado para anúncios com desfecho definitivo há mais de 90 dias,
 *    reduzindo crescimento do TOAST sem tocar em colunas normalizadas ou observações.
 * 2. Expurga execuções antigas de `collector_runs` (> 90 dias), preservando sempre a última execução de cada fonte.
 */
export async function pruneCatalogStorage(
  now: Date,
  options: { rawBatchLimit?: number } = {},
): Promise<RetentionSummary> {
  const requestedLimit = options.rawBatchLimit ?? DEFAULT_RAW_PRUNE_BATCH;
  const rawBatchLimit = Number.isFinite(requestedLimit) ? Math.max(0, Math.trunc(requestedLimit)) : 0;
  const rawCutoff = rawRetentionCutoff(now);
  const runCutoff = collectorRunRetentionCutoff(now);
  const statuses = Prisma.join(PRUNABLE_RAW_STATUSES.map((status) => Prisma.sql`${status}::listing_status`));

  // Não atualiza `updated_at` de propósito: preserva ordenação de atividade real e favorece HOT update no Postgres.
  const rawPruned =
    rawBatchLimit === 0
      ? 0
      : await db.$executeRaw`
    WITH target AS (
      SELECT id
      FROM listings
      WHERE next_check_at IS NULL
        AND status IN (${statuses})
        AND last_checked_at < ${rawCutoff}
        AND raw <> '{}'::jsonb
      ORDER BY last_checked_at ASC
      LIMIT ${rawBatchLimit}
    )
    UPDATE listings l
    SET raw = '{}'::jsonb
    FROM target
    WHERE l.id = target.id
  `;

  const runsDeleted = await db.$executeRaw`
    DELETE FROM collector_runs
    WHERE status <> 'running'::collector_run_status
      AND started_at < ${runCutoff}
      AND id NOT IN (
        SELECT DISTINCT ON (source_id) id
        FROM collector_runs
        ORDER BY source_id, started_at DESC, id DESC
      )
  `;

  return { rawPruned, runsDeleted };
}
