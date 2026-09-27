import "server-only";

export const COLLECTOR_USER_AGENT = "LeilaoTracker/1.0 (+https://github.com/LeonardoBMar/leilao)";

export type FetchOutcome = { ok: true; text: string } | { ok: false; status: number | null; error: string };

export type PoliteFetcher = {
  get: (url: string) => Promise<FetchOutcome>;
  /** Requisições feitas até agora, contando novas tentativas. */
  readonly requests: number;
};

type Options = {
  /** Intervalo mínimo entre requisições (a mesma fonte): padrão 1 s. */
  minIntervalMs?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

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
}: Options = {}): PoliteFetcher {
  let lastRequestAt = Number.NEGATIVE_INFINITY;
  let requests = 0;

  async function attempt(url: string): Promise<FetchOutcome & { retryAfterMs?: number; retry: boolean }> {
    const wait = lastRequestAt + minIntervalMs - now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = now();
    requests++;
    try {
      const response = await fetchImpl(url, {
        headers: { "user-agent": userAgent, accept: "text/html,application/xml;q=0.9,*/*;q=0.8" },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
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

  return {
    get requests() {
      return requests;
    },
    async get(url) {
      for (let tryNumber = 1; ; tryNumber++) {
        const { retry, retryAfterMs, ...outcome } = await attempt(url);
        if (outcome.ok || !retry || tryNumber >= maxAttempts) return outcome;
        await sleep(Math.min(retryAfterMs ?? 2 ** tryNumber * 1_000, MAX_RETRY_AFTER_MS));
      }
    },
  };
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
}
