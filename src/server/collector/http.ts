import "server-only";

import type { FetchOutcome, SourceHttp } from "@/sources/types";

export const COLLECTOR_USER_AGENT = "LeilaoTracker/1.0 (+https://github.com/LeonardoBMar/leilao)";

export type PoliteFetcher = SourceHttp & {
  /** Requisições feitas até agora, contando novas tentativas. */
  readonly requests: number;
  /**
   * A última resposta foi falha do site (`isSiteFailure`): rede, tempo esgotado, recusa ou erro do servidor. Conta para
   * a parada por falhas seguidas (D-41); página que veio mas não serve (outro anúncio, formato novo) não conta.
   */
  readonly siteFailing: boolean;
};

type Request = { url: string; form?: Readonly<Record<string, string>> };

type Options = {
  /** Intervalo mínimo entre requisições (a mesma fonte): padrão 1 s. */
  minIntervalMs?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /**
   * Fim do tempo da execução (ms desde a época, no relógio de `now`). Depois dele nenhuma requisição sai, nem nova
   * tentativa: a resposta é uma falha na hora. Uma fonte fora do ar não segura a coleta inteira até o job ser morto.
   */
  deadline?: number;
};

export const DEADLINE_ERROR = "tempo da execução esgotado";

/** Falha que indica site fora do ar ou bloqueando o coletor; 404 e 410 dizem respeito só ao anúncio pedido. */
export function isSiteFailure(outcome: FetchOutcome): boolean {
  return !outcome.ok && outcome.status !== 404 && outcome.status !== 410;
}

const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_RETRY_AFTER_MS = 60_000;

/**
 * Acesso educado a uma fonte (docs/PLANO-COLETA.md §3): uma requisição por vez, intervalo mínimo,
 * identificação clara e novas tentativas com espera crescente em falhas temporárias (429, 5xx, rede).
 * 404/410 e outros erros definitivos voltam na hora, sem nova tentativa.
 */
export function createPoliteFetcher({
  minIntervalMs = 1_000,
  timeoutMs = 20_000,
  maxAttempts = 3,
  userAgent = COLLECTOR_USER_AGENT,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
  deadline = Number.POSITIVE_INFINITY,
}: Options = {}): PoliteFetcher {
  let lastRequestAt = Number.NEGATIVE_INFINITY;
  let requests = 0;
  let siteFailing = false;

  async function attempt({ url, form }: Request): Promise<FetchOutcome & { retryAfterMs?: number; retry: boolean }> {
    const wait = lastRequestAt + minIntervalMs - now();
    if (wait > 0) await sleep(wait);
    if (now() >= deadline) return { ok: false, status: null, error: DEADLINE_ERROR, retry: false };
    lastRequestAt = now();
    requests++;
    try {
      const response = await fetchImpl(url, {
        method: form ? "POST" : "GET",
        headers: { "user-agent": userAgent, accept: "text/html,application/xml,application/json;q=0.9,*/*;q=0.8" },
        ...(form ? { body: new URLSearchParams(form) } : {}),
        redirect: "follow",
        // O tempo da requisição também para no fim da execução.
        signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, deadline - now()))),
      });
      if (response.ok) return { ok: true, text: await response.text(), retry: false };
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}`,
        retry: RETRY_STATUSES.has(response.status),
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
      };
    } catch (error) {
      return { ok: false, status: null, error: error instanceof Error ? error.message : String(error), retry: true };
    }
  }

  async function send(request: Request): Promise<FetchOutcome> {
    for (let tryNumber = 1; ; tryNumber++) {
      const { retry, retryAfterMs, ...outcome } = await attempt(request);
      if (outcome.ok || !retry || tryNumber >= maxAttempts) {
        siteFailing = isSiteFailure(outcome);
        return outcome;
      }
      await sleep(Math.min(retryAfterMs ?? 2 ** tryNumber * 1_000, MAX_RETRY_AFTER_MS));
    }
  }

  return {
    get requests() {
      return requests;
    },
    get siteFailing() {
      return siteFailing;
    },
    get: (url) => send({ url }),
    // Consulta de leitura (ex.: situação de vários lotes de uma vez): mesmas regras de ritmo e de novas tentativas.
    post: (url, form) => send({ url, form }),
  };
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
}
