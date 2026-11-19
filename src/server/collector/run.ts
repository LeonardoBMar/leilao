import "server-only";

import { planVisits } from "@/domain/listings/collect";
import { err, ok, type Result } from "@/lib/result";
import { listingContractProblems } from "@/sources/shared/contract";
import type { SourceAdapter } from "@/sources/types";

import { db } from "../db";
import { env } from "../env";
import { createFipeCatalog, type FipeCatalog } from "../fipe/catalog";
import { ensureFipeCatalog, type FipeImportResult } from "../fipe/dataset";
import { enrichMarketValues } from "../fipe/enrich";
import { createAlerts } from "./alerts";
import { createPoliteFetcher, DEADLINE_ERROR, type PoliteFetcher } from "./http";
import { recordTrackedResults, syncTrackedLots } from "./lots";
import {
  findDueVisits,
  findKnownIds,
  findStoredRaw,
  findTrackedVisits,
  hasOpenListings,
  loadPlaceLookup,
  markGone,
  markSeen,
  type PlaceLookup,
  recordCheckFailure,
  saveListing,
} from "./store";

const MAX_ERROR_SAMPLES = 20;
/**
 * Tempo das fontes numa execução. O job tem 20 min (`.github/workflows/collect.yml`); sobram ~8 para instalar, para
 * os passos comuns (lotes ligados, alertas) e para fechar os registros.
 */
const DEFAULT_BUDGET_MS = 12 * 60_000;
/**
 * Falhas seguidas **do site** (rede, tempo, recusa, 5xx) que param a fonte nesta execução: o site caiu ou bloqueou o
 * coletor, não vale insistir. Anúncio que falha com a página em mãos (outro anúncio, formato novo) não conta e zera a
 * sequência, porque prova que o site responde.
 */
const MAX_CONSECUTIVE_FAILURES = 10;
/** Falhas seguidas de formato/contrato sem nenhum anúncio gravado indicam quebra de layout da fonte. */
const MAX_CONSECUTIVE_PARSE_FAILURES = 20;
const SYSTEMIC_FAILURE_MIN_VISITS = 10;
/** Execução ainda "running" depois disto foi morta antes de fechar o registro (o job passa de 20 min). */
const STALE_RUN_MS = 30 * 60_000;
/** Depois das fontes, tempo para casar na FIPE os anúncios gravados no fim da coleta (D-47, D-51). */
const FIPE_TAIL_MS = 2 * 60_000;

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
  /** Anúncios que ganharam valor de mercado casado na FIPE nesta execução (D-47). */
  marketValuesMatched: number;
  /** Meses da tabela FIPE baixados (ou tentados) do dataset nesta execução (D-51); vazio se nada faltava. */
  fipeImports: FipeImportResult[];
  /**
   * Problemas do valor de mercado (importação da tabela, casamento). Só aviso no log: não marcam a coleta como falha,
   * porque o anúncio fica pendente e a próxima execução tenta de novo.
   */
  warnings: string[];
  /** Falhas dos passos comuns a todas as fontes (lotes ligados, alertas). */
  errors: RunError[];
};

type RunOptions = {
  sources: readonly SourceAdapter[];
  /** Limite de anúncios lidos por fonte nesta execução (a descoberta não conta). */
  maxVisits?: number;
  /**
   * Um acesso educado por fonte: o intervalo mínimo vale por site, então fontes diferentes andam em paralelo. Recebe o
   * fim do tempo da execução (ms desde a época), depois do qual o acesso não faz mais requisições.
   */
  createFetcher?: (source: SourceAdapter, deadline: number) => PoliteFetcher;
  /** Tempo das fontes nesta execução; depois dele as fontes param e os passos comuns rodam. */
  budgetMs?: number;
  /**
   * Catálogo da FIPE para o casamento do valor de mercado. Padrão: o do banco, com a importação do mês que faltar,
   * se `FIPE_LOOKUP` não for "off"; `null` desliga.
   */
  fipe?: FipeCatalog | null;
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
  createFetcher = (_source, deadline) => createPoliteFetcher({ deadline }),
  budgetMs = DEFAULT_BUDGET_MS,
  now = () => new Date(),
  fipe,
}: RunOptions): Promise<CollectionSummary> {
  const startedAt = now();
  const deadline = startedAt.getTime() + budgetMs;
  const catalog = fipe !== undefined ? fipe : env.FIPE_LOOKUP === "on" ? createFipeCatalog() : null;
  await closeStaleRuns(startedAt);
  // Uma leitura dos municípios para todas as fontes; se falhar, cada fonte registra a falha na sua execução.
  const place = loadPlaceLookup().then(
    (lookup): PlaceLoad => ({ ok: true, lookup }),
    (error: unknown): PlaceLoad => ({ ok: false, error }),
  );
  const errors: RunError[] = [];
  const warnings: string[] = [];
  const warn = (message: string) => {
    warnings.push(message);
    console.warn(`aviso: ${message}`);
  };
  // Valor de mercado (D-51): primeiro a tabela do mês que faltar no catálogo (baixada do dataset), depois o casamento,
  // junto com as fontes (o que já estava pendente) e, depois delas, por pouco tempo, para os anúncios gravados no fim.
  // Tudo antes dos alertas, que olham o % do mercado. Problema aqui é aviso: o resto fica para a próxima execução.
  const imports = (catalog && fipe === undefined ? ensureFipeCatalog({ now: startedAt }) : Promise.resolve([])).then(
    (results: FipeImportResult[]) => {
      for (const result of results) {
        if (result.kind === "failed") warn(`tabela FIPE ${result.month}: ${result.error}`);
      }
      return results;
    },
  );
  let fipeStopped = false;
  const enrich = async (until: number) => {
    await imports;
    if (!catalog || fipeStopped) return 0;
    try {
      const summary = await enrichMarketValues({ catalog, now, deadline: until });
      if (summary.stoppedBy?.kind === "no_catalog") {
        fipeStopped = true;
        warn(`valor de mercado: ${summary.stoppedBy.message}`);
      }
      return summary.matched.version + summary.matched.family;
    } catch (error) {
      fipeStopped = true;
      warn(`valor de mercado: ${describeError(error)}`);
      return 0;
    }
  };

  const [runs, matchedDuring] = await Promise.all([
    Promise.all(
      sources.map((source) =>
        collectSource({ source, fetcher: createFetcher(source, deadline), maxVisits, deadline, place, now }),
      ),
    ),
    enrich(deadline),
  ]);
  const marketValuesMatched = matchedDuring + (await enrich(now().getTime() + FIPE_TAIL_MS));
  const fipeImports = await imports;

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
    marketValuesMatched,
    fipeImports,
    warnings,
    errors: errors.slice(0, MAX_ERROR_SAMPLES),
  };
}

/** Municípios carregados uma vez para todas as fontes; a falha vira erro registrado de cada fonte. */
type PlaceLoad = { ok: true; lookup: PlaceLookup } | { ok: false; error: unknown };

/**
 * Fecha como falha as execuções que ficaram "running": o job foi morto antes de gravar o fim (ex.: uma fonte travada
 * segurou a coleta até o limite do GitHub). Sem isso o app mostraria uma coleta eternamente em andamento.
 */
async function closeStaleRuns(startedAt: Date) {
  await db.collectorRun.updateMany({
    where: { status: "running", startedAt: { lt: new Date(startedAt.getTime() - STALE_RUN_MS) } },
    data: {
      status: "failed",
      finishedAt: startedAt,
      errors: [{ url: "(execução)", error: "interrompida antes do fim (tempo do job esgotado)" }],
    },
  });
}

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
  deadline: number;
  place: Promise<PlaceLoad>;
  now: () => Date;
}): Promise<SourceRun> {
  const { source, fetcher, maxVisits, deadline, place, now } = input;
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
        deadline,
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
      const systemicParseFailure =
        counters.failed >= SYSTEMIC_FAILURE_MIN_VISITS &&
        ((counters.created === 0 && counters.updated === 0) || counters.failed > counters.created + counters.updated);
      const status =
        discoveryFailed || systemicParseFailure || common.errors.length > 0 || runId === "" ? "failed" : "succeeded";
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
  deadline: number;
  place: PlaceLookup;
  now: () => Date;
  fail: (url: string, error: string) => void;
  counters: { discovered: number; created: number; updated: number; failed: number };
}): Promise<boolean> {
  const { source, fetcher, maxVisits, deadline, place, now, fail, counters } = input;
  const discovery = await source.discover(fetcher, now());
  for (const { url, error } of discovery.errors) fail(url, error);
  counters.discovered = discovery.listings.length;
  const emptyWithOpen = discovery.complete && discovery.listings.length === 0 && (await hasOpenListings(source.id));
  if (emptyWithOpen) fail("(descoberta)", "nenhum anúncio encontrado com abertos existentes no catálogo");

  const discoveredIds = discovery.listings.map((item) => item.externalId);
  const knownIds = await findKnownIds(source.id, discoveredIds);
  const seenAt = now();
  await markSeen(source.id, [...knownIds], seenAt);
  // Com a lista completa (e sem descoberta vazia suspeita), "não visto agora" significa "saiu da lista" (`goneStatus`).
  const listReadAt = discovery.complete && !emptyWithOpen ? seenAt : null;

  // Lotes acompanhados primeiro: o lance deles é o que o usuário está olhando.
  const due = [
    ...(await findTrackedVisits(source.id, now(), maxVisits)),
    ...(await findDueVisits(source.id, now(), maxVisits)),
  ];
  const visits = planVisits({ due, discovered: discovery.listings, knownIds, budget: maxVisits });

  let consecutiveFailures = 0;
  let consecutiveParseFailures = 0;
  for (const [index, visit] of visits.entries()) {
    // Fim do tempo ou fonte que só falha (rede ou formato quebrado): o resto fica para a próxima execução.
    const stop =
      now().getTime() >= deadline
        ? DEADLINE_ERROR
        : consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
          ? `${MAX_CONSECUTIVE_FAILURES} falhas seguidas`
          : consecutiveParseFailures >= MAX_CONSECUTIVE_PARSE_FAILURES &&
              counters.created === 0 &&
              counters.updated === 0
            ? `${MAX_CONSECUTIVE_PARSE_FAILURES} falhas seguidas de formato`
            : null;
    if (stop) {
      fail("(execução)", `${stop}; ${visits.length - index} anúncios ficaram para a próxima execução`);
      return true;
    }
    const url = source.listingUrl(visit.externalId);
    // Qualquer falha afeta só este anúncio. Revisita que falha é reagendada com espera crescente,
    // para não gastar o limite de toda execução com o mesmo anúncio.
    let problem: string;
    let siteError = false;
    let parseError = false;
    fetcher.resetSiteFailing();
    try {
      const outcome = await visitListing(source, fetcher, visit.externalId, { now: now(), place }, listReadAt);
      if (outcome.ok) {
        counters[outcome.value]++;
        consecutiveFailures = 0;
        consecutiveParseFailures = 0;
        continue;
      }
      problem = outcome.error;
      siteError = fetcher.siteFailing;
      parseError = !siteError;
    } catch (error) {
      // Erro inesperado (ex.: dado recusado por um CHECK do banco): não é queda do site.
      problem = describeError(error);
    }
    consecutiveFailures = siteError ? consecutiveFailures + 1 : 0;
    consecutiveParseFailures = parseError ? consecutiveParseFailures + 1 : 0;
    fail(url, problem);
    if (visit.reason === "due") await recordCheckFailure(source.id, visit.externalId, now());
  }
  return !discovery.complete || emptyWithOpen;
}

/**
 * Baixa, lê, confere e grava um anúncio. Falha esperada volta como valor; erro inesperado lança. Também usada pela
 * carga avulsa de encerrados (`backfill.ts`), para gravar pelo mesmo caminho da coleta.
 */
export async function visitListing(
  source: SourceAdapter,
  fetcher: PoliteFetcher,
  externalId: string,
  context: Parameters<typeof saveListing>[2],
  listReadAt: Date | null,
): Promise<Result<"created" | "updated">> {
  const stored = source.usesStoredRaw ? await findStoredRaw(source.id, externalId) : null;
  const fetched = await source.fetchListing(fetcher, externalId, context.now, stored);
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
