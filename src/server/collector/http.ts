import "server-only";

import type { FetchOutcome, SourceHttp } from "@/sources/types";

import { installExtraCaCertificates } from "./tls";

export const COLLECTOR_USER_AGENT = "LeilaoTracker/1.0 (+https://github.com/LeonardoBMar/leilao)";

export type PoliteFetcher = SourceHttp & {
  /** Requisições feitas até agora, contando novas tentativas. */
  readonly requests: number;
  /**
   * A última resposta foi falha do site (`isSiteFailure`): rede, tempo esgotado, recusa ou erro do servidor. Conta para
   * a parada por falhas seguidas (D-41); página que veio mas não serve (outro anúncio, formato novo) não conta.
   */
  readonly siteFailing: boolean;
  /** Zera `siteFailing` antes de visitar outro anúncio (evita vazar falha HTTP da visita anterior). */
  resetSiteFailing: () => void;
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
  random?: () => number;
  /** Limite máximo do corpo da resposta em bytes (padrão 10 MB). */
  maxBytes?: number;
  /**
   * Fim do tempo da execução (ms desde a época, no relógio de `now`). Depois dele nenhuma requisição sai, nem nova
   * tentativa: a resposta é uma falha na hora. Uma fonte fora do ar não segura a coleta inteira até o job ser morto.
   */
  deadline?: number;
};

export const DEADLINE_ERROR = "tempo da execução esgotado";
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

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
  maxBytes = DEFAULT_MAX_BYTES,
  userAgent = COLLECTOR_USER_AGENT,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
  random = Math.random,
  deadline = Number.POSITIVE_INFINITY,
}: Options = {}): PoliteFetcher {
  if (fetchImpl === fetch) installExtraCaCertificates();
  let lastRequestAt = Number.NEGATIVE_INFINITY;
  let requests = 0;
  let siteFailing = false;
  let deadlineReached = false;

  async function attempt({ url, form }: Request): Promise<FetchOutcome & { retryAfterMs?: number; retry: boolean }> {
    if (!isAllowedPublicUrl(url)) {
      return { ok: false, status: null, error: "URL bloqueada pela política do coletor", retry: false };
    }
    if (deadlineReached || now() >= deadline) {
      deadlineReached = true;
      return { ok: false, status: null, error: DEADLINE_ERROR, retry: false };
    }
    const wait = lastRequestAt + minIntervalMs - now();
    if (wait > 0) {
      if (now() + wait >= deadline) {
        deadlineReached = true;
        return { ok: false, status: null, error: DEADLINE_ERROR, retry: false };
      }
      await sleep(wait);
    }
    if (now() >= deadline) {
      deadlineReached = true;
      return { ok: false, status: null, error: DEADLINE_ERROR, retry: false };
    }
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
      if (response.url && !isAllowedPublicUrl(response.url)) {
        await response.body?.cancel().catch(() => {});
        return { ok: false, status: null, error: "redirecionamento bloqueado pela política do coletor", retry: false };
      }
      if (response.ok) {
        const text = await readTextWithLimit(response, maxBytes);
        if (text === null) {
          return { ok: false, status: response.status, error: "resposta excede o limite de tamanho", retry: false };
        }
        return { ok: true, text, retry: false };
      }
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}`,
        retry: RETRY_STATUSES.has(response.status),
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after"), now()),
      };
    } catch (error) {
      return { ok: false, status: null, error: formatFetchError(error), retry: true };
    }
  }

  async function send(request: Request): Promise<FetchOutcome> {
    for (let tryNumber = 1; ; tryNumber++) {
      const { retry, retryAfterMs, ...outcome } = await attempt(request);
      if (outcome.ok || !retry || tryNumber >= maxAttempts) {
        siteFailing = isSiteFailure(outcome);
        return outcome;
      }
      const jitter = 0.8 + random() * 0.4;
      const baseDelay = retryAfterMs ?? Math.round(2 ** tryNumber * 1_000 * jitter);
      const delay = Math.min(baseDelay, MAX_RETRY_AFTER_MS);
      if (now() + delay >= deadline) {
        deadlineReached = true;
        const expired: FetchOutcome = { ok: false, status: null, error: DEADLINE_ERROR };
        siteFailing = isSiteFailure(expired);
        return expired;
      }
      await sleep(delay);
    }
  }

  return {
    get requests() {
      return requests;
    },
    get siteFailing() {
      return siteFailing;
    },
    resetSiteFailing() {
      siteFailing = false;
    },
    get: (url) => send({ url }),
    // Consulta de leitura (ex.: situação de vários lotes de uma vez): mesmas regras de ritmo e de novas tentativas.
    post: (url, form) => send({ url, form }),
  };
}

function formatFetchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (!(cause instanceof Error)) return error.message;
  const code = "code" in cause && typeof cause.code === "string" ? cause.code : null;
  const detail = code ? `${code}: ${cause.message}` : cause.message;
  return detail ? `${error.message} (${detail})` : error.message;
}

function parseRetryAfter(value: string | null, nowMs: number): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - nowMs) : undefined;
}

/** Rejeita esquemas não-HTTP(S) e destinos locais/privados (loopback, link-local, RFC 1918 e ULA). */
function isAllowedPublicUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "" || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  if (
    host === "::1" ||
    host === "0.0.0.0" ||
    host.startsWith("fe80:") ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    return false;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
  }
  return true;
}

/** Lê a resposta como UTF-8 respeitando `maxBytes`; devolve `null` e cancela o stream se ultrapassar. */
async function readTextWithLimit(response: Response, maxBytes: number): Promise<string | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    return null;
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    return Buffer.byteLength(text, "utf8") <= maxBytes ? text : null;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const decoder = new TextDecoder();
  return chunks.map((chunk, index) => decoder.decode(chunk, { stream: index < chunks.length - 1 })).join("");
}
