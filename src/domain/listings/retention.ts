import { isFinalStatus, type ListingStatus } from "./types";

/**
 * Política de retenção do catálogo coletado (D-87): mantém o banco sustentável sem perder histórico analítico.
 *
 * - `listings.raw` (TOAST): compactado para `{}` após 90 dias do encerramento definitivo (`nextCheckAt = null`).
 *   Todas as colunas normalizadas, fotos, FIPE e observações permanecem intactas.
 * - `collector_runs`: execuções finalizadas há mais de 90 dias são removidas, sempre preservando ao menos a última
 *   execução de cada fonte (para o indicador de saúde).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const RAW_RETENTION_DAYS = 90;
export const COLLECTOR_RUN_RETENTION_DAYS = 90;

/** Limite de anúncios compactados por execução da coleta, evitando locks longos e picos de autovacuum. */
export const DEFAULT_RAW_PRUNE_BATCH = 1_000;

/** Situações definitivas elegíveis para compactação de `listings.raw` (`unknown` fica preservado para `reparse`). */
export const PRUNABLE_RAW_STATUSES = ["sold", "unsold", "withdrawn"] as const satisfies readonly ListingStatus[];

export function rawRetentionCutoff(now: Date, retentionDays = RAW_RETENTION_DAYS): Date {
  return new Date(now.getTime() - retentionDays * DAY_MS);
}

export function collectorRunRetentionCutoff(now: Date, retentionDays = COLLECTOR_RUN_RETENTION_DAYS): Date {
  return new Date(now.getTime() - retentionDays * DAY_MS);
}

/**
 * Decide se o payload bruto (`listings.raw`) de um anúncio já pode ser compactado para `{}`.
 * Anúncios ainda acompanhados (`nextCheckAt !== null`) ou sem desfecho definitivo nunca são tocados.
 */
export function isRawPrunable(
  listing: { status: ListingStatus; nextCheckAt: Date | null; lastCheckedAt: Date },
  now: Date,
  retentionDays = RAW_RETENTION_DAYS,
): boolean {
  if (listing.nextCheckAt !== null) return false;
  if (!isFinalStatus(listing.status)) return false;
  return listing.lastCheckedAt.getTime() < rawRetentionCutoff(now, retentionDays).getTime();
}
