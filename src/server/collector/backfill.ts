import "server-only";

import type { SourceAdapter } from "@/sources/types";

import type { PoliteFetcher } from "./http";
import { visitListing } from "./run";
import { findKnownIds, loadPlaceLookup } from "./store";

/** Falhas seguidas do site que param a carga: o site caiu ou bloqueou, não vale insistir (como na coleta, D-41). */
const MAX_CONSECUTIVE_FAILURES = 10;
const MAX_ERROR_SAMPLES = 20;

export type BackfillSummary = {
  /** Ids recebidos que já estavam no catálogo: ficam com a coleta agendada. */
  skipped: number;
  created: number;
  updated: number;
  failed: number;
  /** Parou por falhas seguidas do site antes de visitar todos. */
  stopped: boolean;
  errors: { url: string; error: string }[];
};

/**
 * Carga avulsa de anúncios de uma fonte pelo id (D-60): grava pelo mesmo caminho da coleta (`visitListing`: contrato
 * comum, privacidade, desfecho), sem registro em `collector_runs` e fora do limite de visitas da execução agendada.
 * Anúncio já conhecido não é visitado. O valor de mercado fica para a próxima coleta, que casa os pendentes.
 */
export async function backfillListings(input: {
  source: SourceAdapter;
  externalIds: readonly string[];
  fetcher: PoliteFetcher;
  now?: () => Date;
  onProgress?: (done: number, total: number) => void;
}): Promise<BackfillSummary> {
  const { source, externalIds, fetcher, now = () => new Date(), onProgress } = input;
  const known = await findKnownIds(source.id, externalIds);
  const pending = externalIds.filter((id) => !known.has(id));
  const place = await loadPlaceLookup();
  const summary: BackfillSummary = {
    skipped: externalIds.length - pending.length,
    created: 0,
    updated: 0,
    failed: 0,
    stopped: false,
    errors: [],
  };
  const fail = (url: string, error: string) => {
    summary.failed++;
    if (summary.errors.length < MAX_ERROR_SAMPLES) summary.errors.push({ url, error });
  };

  let consecutiveFailures = 0;
  for (const [index, externalId] of pending.entries()) {
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      summary.stopped = true;
      fail("(carga)", `${MAX_CONSECUTIVE_FAILURES} falhas seguidas; ${pending.length - index} anúncios não visitados`);
      break;
    }
    const url = source.listingUrl(externalId);
    fetcher.resetSiteFailing();
    try {
      const outcome = await visitListing(source, fetcher, externalId, { now: now(), place }, null);
      if (outcome.ok) {
        summary[outcome.value]++;
        consecutiveFailures = 0;
      } else {
        fail(url, outcome.error);
        consecutiveFailures = fetcher.siteFailing ? consecutiveFailures + 1 : 0;
      }
    } catch (error) {
      fail(url, error instanceof Error ? error.message.slice(0, 500) : String(error));
      consecutiveFailures = 0;
    }
    onProgress?.(index + 1, pending.length);
  }
  return summary;
}
