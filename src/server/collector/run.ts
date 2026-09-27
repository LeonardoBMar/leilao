import "server-only";

import { planVisits } from "@/domain/listings/collect";
import { err, ok, type Result } from "@/lib/result";
import type { DiscoveredListing, SourceAdapter } from "@/sources/types";

import { db } from "../db";
import { createPoliteFetcher, type PoliteFetcher } from "./http";
import { findDueVisits, findKnownIds, loadPlaceLookup, markSeen, recordCheckFailure, saveListing } from "./store";

const MAX_ERROR_SAMPLES = 20;

export type CollectorSummary = {
  runId: string;
  sourceId: string;
  /** `skipped`: fonte pausada (`sources.active = false`); nada foi acessado. */
  status: "succeeded" | "failed" | "skipped";
  requests: number;
  discovered: number;
  created: number;
  updated: number;
  failed: number;
  errors: { url: string; error: string }[];
};

type RunOptions = {
  source: SourceAdapter;
  /** Limite de páginas de anúncio por execução (sitemaps não contam). */
  maxVisits?: number;
  fetcher?: PoliteFetcher;
  now?: () => Date;
};

/**
 * Uma execução do coletor para uma fonte (docs/PLANO-COLETA.md §3):
 * sitemap → marca vistos → revisitas vencidas + anúncios novos → baixa, lê e grava → registra a execução.
 * Falha de um anúncio não derruba a execução; ela fica registrada em `collector_runs.errors`.
 */
export async function runCollector({
  source,
  maxVisits = 400,
  fetcher = createPoliteFetcher(),
  now = () => new Date(),
}: RunOptions): Promise<CollectorSummary> {
  const sourceRow = await db.source.findUnique({ where: { id: source.id }, select: { active: true } });
  if (!sourceRow) throw new Error(`Fonte "${source.id}" não cadastrada na tabela sources.`);
  if (!sourceRow.active) {
    return {
      runId: "",
      sourceId: source.id,
      status: "skipped",
      requests: 0,
      discovered: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };
  }

  const run = await db.collectorRun.create({ data: { sourceId: source.id, startedAt: now() }, select: { id: true } });
  const errors: CollectorSummary["errors"] = [];
  const counters = { discovered: 0, created: 0, updated: 0, failed: 0 };
  const fail = (url: string, error: string) => {
    counters.failed++;
    if (errors.length < MAX_ERROR_SAMPLES) errors.push({ url, error });
  };

  let sitemapFailed = false;
  try {
    const discovered: DiscoveredListing[] = [];
    for (const sitemapUrl of source.sitemapUrls) {
      const response = await fetcher.get(sitemapUrl);
      if (!response.ok) {
        sitemapFailed = true;
        fail(sitemapUrl, response.error);
        continue;
      }
      discovered.push(...source.parseSitemap(response.text));
    }
    counters.discovered = discovered.length;

    const discoveredIds = discovered.map((item) => item.externalId);
    const knownIds = await findKnownIds(source.id, discoveredIds);
    await markSeen(source.id, [...knownIds], now());

    const due = await findDueVisits(source.id, now(), maxVisits);
    const visits = planVisits({ due, discovered, knownIds, budget: maxVisits });
    const place = await loadPlaceLookup();

    for (const visit of visits) {
      // Sempre pela URL canônica: a do sitemap pode trazer parâmetros de busca.
      const url = source.listingUrl(visit.externalId);
      // Qualquer falha afeta só este anúncio. Revisita que falha é reagendada com espera crescente,
      // para não gastar o limite de toda execução com o mesmo anúncio.
      let problem: string;
      try {
        const outcome = await visitListing(source, fetcher, url, visit.externalId, { now: now(), place });
        if (outcome.ok) {
          counters[outcome.value]++;
          continue;
        }
        problem = outcome.error;
      } catch (error) {
        // Erro inesperado (ex.: dado recusado por um CHECK do banco).
        problem = describeError(error);
      }
      fail(url, problem);
      if (visit.reason === "due") await recordCheckFailure(source.id, visit.externalId, now());
    }
  } catch (error) {
    fail("(execução)", describeError(error));
    sitemapFailed = true;
  }

  const status = sitemapFailed ? "failed" : "succeeded";
  await db.collectorRun.update({
    where: { id: run.id },
    data: { status, finishedAt: now(), requests: fetcher.requests, errors, ...counters },
  });
  return { runId: run.id, sourceId: source.id, status, requests: fetcher.requests, errors, ...counters };
}

/** Baixa, lê e grava um anúncio. Falha esperada volta como valor; erro inesperado lança. */
async function visitListing(
  source: SourceAdapter,
  fetcher: PoliteFetcher,
  url: string,
  expectedId: string,
  context: Parameters<typeof saveListing>[2],
): Promise<Result<"created" | "updated">> {
  const response = await fetcher.get(url);
  if (!response.ok) return err(response.error);
  const parsed = source.parseListingPage(response.text, context.now);
  if (!parsed.ok) return err(parsed.error);
  // A página precisa ser do anúncio pedido; senão gravaria outro registro e este nunca seria reagendado.
  if (parsed.value.externalId !== expectedId) return err(`página de outro anúncio (${parsed.value.externalId})`);
  return ok(await saveListing(source.id, parsed.value, context));
}

/** Texto do erro para `collector_runs.errors`: nunca vazio (alguns erros do banco vêm sem mensagem). */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = "code" in error && typeof error.code === "string" ? ` [${error.code}]` : "";
  const message = error.message.trim().split("\n").filter(Boolean).at(-1) ?? "";
  return `${message || error.name}${code}`.slice(0, 500);
}
