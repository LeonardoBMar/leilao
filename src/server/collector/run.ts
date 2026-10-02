import "server-only";

import { planVisits } from "@/domain/listings/collect";
import { err, ok, type Result } from "@/lib/result";
import { listingContractProblems } from "@/sources/shared/contract";
import type { SourceAdapter } from "@/sources/types";

import { db } from "../db";
import { createAlerts } from "./alerts";
import { createPoliteFetcher, type PoliteFetcher } from "./http";
import { recordTrackedResults, syncTrackedLots } from "./lots";
import {
  findDueVisits,
  findKnownIds,
  findTrackedVisits,
  loadPlaceLookup,
  markGone,
  markSeen,
  type PlaceLookup,
  recordCheckFailure,
  saveListing,
} from "./store";

const MAX_ERROR_SAMPLES = 20;

type RunError = { url: string; error: string };

export type SourceRunSummary = {
  runId: string;
  sourceId: string;
  /** `skipped`: fonte pausada (`sources.active = false`); nada foi acessado. */
  status: "succeeded" | "failed" | "skipped";
  requests: number;
  discovered: number;
  created: number;
  updated: number;
  failed: number;
  errors: RunError[];
};

export type CollectionSummary = {
  status: "succeeded" | "failed";
  sources: SourceRunSummary[];
  /** Lotes de usuários cujo lance atual veio do anúncio ligado (etapa 3). */
  lotsUpdated: number;
  /** Resultados registrados sozinhos nos lotes ligados a anúncios encerrados (etapa 4). */
  resultsRecorded: number;
  alertsCreated: number;
  /** Falhas dos passos comuns a todas as fontes (lotes ligados, alertas). */
  errors: RunError[];
};

type RunOptions = {
  sources: readonly SourceAdapter[];
  /** Limite de anúncios lidos por fonte nesta execução (a descoberta não conta). */
  maxVisits?: number;
  /** Um acesso educado por fonte: o intervalo mínimo vale por site, então fontes diferentes andam em paralelo. */
  createFetcher?: (source: SourceAdapter) => PoliteFetcher;
  now?: () => Date;
};

/**
 * Uma execução do coletor (docs/PLANO-COLETA.md §3, D-37): todas as fontes **em paralelo**, cada uma isolada (falha
 * de uma não para as outras) e com o seu registro em `collector_runs`; depois, **uma vez**, os passos que valem para o
 * catálogo inteiro: lance e resultado dos lotes ligados e alertas dos monitores.
 */
export async function runCollection({
  sources,
  maxVisits = 400,
  createFetcher = () => createPoliteFetcher(),
  now = () => new Date(),
}: RunOptions): Promise<CollectionSummary> {
  const startedAt = now();
  // Uma leitura dos municípios para todas as fontes; se falhar, cada fonte registra a falha na sua execução.
  const place = loadPlaceLookup().then(
    (lookup): PlaceLoad => ({ ok: true, lookup }),
    (error: unknown): PlaceLoad => ({ ok: false, error }),
  );
  const runs = await Promise.all(
    sources.map((source) => collectSource({ source, fetcher: createFetcher(source), maxVisits, place, now })),
  );

  const errors: RunError[] = [];
  // Lance e resultado dos lotes ligados, com o que foi lido. Falha aqui não impede os alertas.
  let lotsUpdated = 0;
  let resultsRecorded = 0;
  try {
    lotsUpdated = await syncTrackedLots(startedAt);
    const results = await recordTrackedResults(now());
    resultsRecorded = results.recorded;
    for (const { lotId, error } of results.failures) {
      errors.push({ url: `(resultado do lote ${lotId})`, error: describeError(error) });
    }
  } catch (error) {
    errors.push({ url: "(lotes)", error: describeError(error) });
  }

  // Alertas mesmo se a coleta falhou em parte: o que foi gravado já pode avisar. A próxima execução recupera o que
  // faltar (janela de ALERT_LOOKBACK_MS).
  let alertsCreated = 0;
  try {
    alertsCreated = await createAlerts(now());
  } catch (error) {
    errors.push({ url: "(alertas)", error: describeError(error) });
  }

  // Falha dos passos comuns aparece no registro de cada fonte, para o app mostrar (o cartão lê `collector_runs`).
  const summaries = await Promise.all(runs.map((run) => run.finish({ errors, alertsCreated, finishedAt: now() })));
  const failed = errors.length > 0 || summaries.some((summary) => summary.status === "failed");
  return {
    status: failed ? "failed" : "succeeded",
    sources: summaries,
    lotsUpdated,
    resultsRecorded,
    alertsCreated,
    errors: errors.slice(0, MAX_ERROR_SAMPLES),
  };
}

/** Municípios carregados uma vez para todas as fontes; a falha vira erro registrado de cada fonte. */
type PlaceLoad = { ok: true; lookup: PlaceLookup } | { ok: false; error: unknown };

type FinishInput = { errors: readonly RunError[]; alertsCreated: number; finishedAt: Date };
type SourceRun = { finish: (common: FinishInput) => Promise<SourceRunSummary> };

/**
 * Coleta de uma fonte: descoberta → marca vistos → anúncios ligados a lotes + revisitas vencidas + anúncios novos →
 * baixa, confere o contrato e grava. Nunca lança: erro inesperado vira falha registrada da fonte.
 */
async function collectSource(input: {
  source: SourceAdapter;
  fetcher: PoliteFetcher;
  maxVisits: number;
  place: Promise<PlaceLoad>;
  now: () => Date;
}): Promise<SourceRun> {
  const { source, fetcher, maxVisits, place, now } = input;
  const errors: RunError[] = [];
  const counters = { discovered: 0, created: 0, updated: 0, failed: 0 };
  const fail = (url: string, error: string) => {
    counters.failed++;
    if (errors.length < MAX_ERROR_SAMPLES) errors.push({ url, error });
  };

  let runId = "";
  let skipped = false;
  let discoveryFailed = false;
  try {
    // A fonte se cadastra na primeira execução; depois, só lê se está ativa (pausar não exige deploy).
    const row = await db.source.upsert({
      where: { id: source.id },
      create: { id: source.id, name: source.name, baseUrl: source.baseUrl },
      update: {},
      select: { active: true },
    });
    skipped = !row.active;
    if (!skipped) {
      const run = await db.collectorRun.create({
        data: { sourceId: source.id, startedAt: now() },
        select: { id: true },
      });
      runId = run.id;
      const places = await place;
      if (!places.ok) throw places.error;
      discoveryFailed = await collectListings({
        source,
        fetcher,
        maxVisits: Math.min(maxVisits, source.maxVisitsPerRun ?? maxVisits),
        place: places.lookup,
        now,
        fail,
        counters,
      });
    }
  } catch (error) {
    fail("(execução)", describeError(error));
    discoveryFailed = true;
  }

  return {
    async finish(common) {
      const base = { runId, sourceId: source.id, requests: fetcher.requests, errors, ...counters };
      if (skipped) return { ...base, status: "skipped" };
      for (const { url, error } of common.errors) {
        if (errors.length < MAX_ERROR_SAMPLES) errors.push({ url, error });
      }
      const status = discoveryFailed || common.errors.length > 0 || runId === "" ? "failed" : "succeeded";
      if (runId !== "") {
        await db.collectorRun.update({
          where: { id: runId },
          data: {
            status,
            finishedAt: common.finishedAt,
            requests: fetcher.requests,
            errors,
            alertsCreated: common.alertsCreated,
            ...counters,
          },
        });
      }
      return { ...base, errors, status };
    },
  };
}

/** Devolve `true` se a descoberta não leu a lista inteira (a execução fica como falha). */
async function collectListings(input: {
  source: SourceAdapter;
  fetcher: PoliteFetcher;
  maxVisits: number;
  place: PlaceLookup;
  now: () => Date;
  fail: (url: string, error: string) => void;
  counters: { discovered: number; created: number; updated: number; failed: number };
}): Promise<boolean> {
  const { source, fetcher, maxVisits, place, now, fail, counters } = input;
  const discovery = await source.discover(fetcher, now());
  for (const { url, error } of discovery.errors) fail(url, error);
  counters.discovered = discovery.listings.length;

  const discoveredIds = discovery.listings.map((item) => item.externalId);
  const knownIds = await findKnownIds(source.id, discoveredIds);
  const seenAt = now();
  await markSeen(source.id, [...knownIds], seenAt);
  // Com a lista completa, "não visto agora" significa "saiu da lista da fonte" (goneStatus).
  const listReadAt = discovery.complete ? seenAt : null;

  // Lotes acompanhados primeiro: o lance deles é o que o usuário está olhando.
  const due = [
    ...(await findTrackedVisits(source.id, now(), maxVisits)),
    ...(await findDueVisits(source.id, now(), maxVisits)),
  ];
  const visits = planVisits({ due, discovered: discovery.listings, knownIds, budget: maxVisits });

  for (const visit of visits) {
    const url = source.listingUrl(visit.externalId);
    // Qualquer falha afeta só este anúncio. Revisita que falha é reagendada com espera crescente,
    // para não gastar o limite de toda execução com o mesmo anúncio.
    let problem: string;
    try {
      const outcome = await visitListing(source, fetcher, visit.externalId, { now: now(), place }, listReadAt);
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
  return !discovery.complete;
}

/** Baixa, lê, confere e grava um anúncio. Falha esperada volta como valor; erro inesperado lança. */
async function visitListing(
  source: SourceAdapter,
  fetcher: PoliteFetcher,
  externalId: string,
  context: Parameters<typeof saveListing>[2],
  listReadAt: Date | null,
): Promise<Result<"created" | "updated">> {
  const fetched = await source.fetchListing(fetcher, externalId, context.now);
  // Página fora do ar de anúncio encerrado ou fora da lista da fonte: desfecho, não falha (goneStatus).
  if (!fetched.ok && fetched.gone && (await markGone(source.id, externalId, context.now, listReadAt))) {
    return ok("updated");
  }
  if (!fetched.ok) return err(fetched.error);
  // O anúncio precisa ser o pedido e cumprir o contrato comum; senão vira falha, nunca dado errado no catálogo.
  const problems = listingContractProblems(fetched.value, { externalId, url: source.listingUrl(externalId) });
  if (problems.length > 0) return err(problems.join("; "));
  return ok(await saveListing(source.id, fetched.value, context));
}

/** Texto do erro para `collector_runs.errors`: nunca vazio (alguns erros do banco vêm sem mensagem). */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = "code" in error && typeof error.code === "string" ? ` [${error.code}]` : "";
  const message = error.message.trim().split("\n").filter(Boolean).at(-1) ?? "";
  return `${message || error.name}${code}`.slice(0, 500);
}
