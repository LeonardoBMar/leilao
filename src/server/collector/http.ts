import "server-only";

import { isIP } from "node:net";

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
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
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
      let currentUrl = url;
      let currentMethod: "GET" | "POST" = form ? "POST" : "GET";
      let currentBody = form ? new URLSearchParams(form) : undefined;
      let response: Response;

      for (let redirects = 0; ; redirects++) {
        if (now() >= deadline) {
          deadlineReached = true;
          return { ok: false, status: null, error: DEADLINE_ERROR, retry: false };
        }
        response = await fetchImpl(currentUrl, {
          method: currentMethod,
          headers: { "user-agent": userAgent, accept: "text/html,application/xml,application/json;q=0.9,*/*;q=0.8" },
          ...(currentBody ? { body: currentBody } : {}),
          redirect: "manual",
          // O tempo da requisição também para no fim da execução.
          signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, deadline - now()))),
        });
        if (response.url && !isAllowedPublicUrl(response.url)) {
          await response.body?.cancel().catch(() => {});
          return {
            ok: false,
            status: null,
            error: "redirecionamento bloqueado pela política do coletor",
            retry: false,
          };
        }
        if (!REDIRECT_STATUSES.has(response.status)) break;

        const location = response.headers.get("location");
        if (!location) break;
        await response.body?.cancel().catch(() => {});

        if (redirects >= MAX_REDIRECTS) {
          return { ok: false, status: response.status, error: "redirecionamentos em excesso", retry: false };
        }
        let nextUrl: string;
        try {
          nextUrl = new URL(location, currentUrl).toString();
        } catch {
          return {
            ok: false,
            status: null,
            error: "redirecionamento bloqueado pela política do coletor",
            retry: false,
          };
        }
        if (!isAllowedPublicUrl(nextUrl)) {
          return {
            ok: false,
            status: null,
            error: "redirecionamento bloqueado pela política do coletor",
            retry: false,
          };
        }
        currentUrl = nextUrl;
        if (response.status !== 307 && response.status !== 308 && currentMethod === "POST") {
          currentMethod = "GET";
          currentBody = undefined;
        }
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

const MAX_ERROR_LENGTH = 500;
const MAX_CAUSE_DEPTH = 3;
const FALLBACK_ERROR = "erro desconhecido";

function formatFetchError(error: unknown): string {
  if (!(error instanceof Error)) {
    return truncateError(stringifyUnknownError(error) || FALLBACK_ERROR);
  }
  const seen = new Set<unknown>([error]);
  const base = joinCodeAndMessage(readErrorCode(error), normalizeErrorText(error.message));
  const detail =
    error instanceof AggregateError && error.errors.length > 0
      ? joinAggregateDetails(error.errors, MAX_CAUSE_DEPTH, seen)
      : extractCauseDetail(error.cause, MAX_CAUSE_DEPTH, seen);

  if (base && detail && detail !== base) return truncateError(`${base} (${detail})`);
  return truncateError(base || detail || normalizeErrorText(error.name) || FALLBACK_ERROR);
}

function extractCauseDetail(cause: unknown, remainingDepth: number, seen: Set<unknown>): string {
  if (remainingDepth <= 0 || cause == null) return "";
  if (typeof cause === "string") return normalizeErrorText(cause);
  if (typeof cause !== "object" || seen.has(cause)) return "";
  seen.add(cause);

  if (cause instanceof AggregateError && cause.errors.length > 0) {
    const joined = joinAggregateDetails(cause.errors, remainingDepth, seen);
    if (joined) return joined;
  }

  const code = readErrorCode(cause);
  const message =
    cause instanceof Error
      ? normalizeErrorText(cause.message)
      : "message" in cause && typeof cause.message === "string"
        ? normalizeErrorText(cause.message)
        : "";
  const direct = joinCodeAndMessage(code, message);
  if (direct) return direct;

  if ("cause" in cause) return extractCauseDetail(cause.cause, remainingDepth - 1, seen);
  return "";
}

function joinAggregateDetails(items: readonly unknown[], remainingDepth: number, seen: Set<unknown>): string {
  const parts = new Set<string>();
  for (const item of items) {
    const text = extractCauseDetail(item, remainingDepth - 1, seen);
    if (text) parts.add(text);
  }
  return [...parts].join("; ");
}

function readErrorCode(value: object): string {
  return "code" in value && typeof value.code === "string" ? normalizeErrorText(value.code) : "";
}

function joinCodeAndMessage(code: string, message: string): string {
  if (code && message) return message.includes(code) ? message : `${code}: ${message}`;
  return code || message;
}

function stringifyUnknownError(error: unknown): string {
  try {
    return normalizeErrorText(String(error));
  } catch {
    return "";
  }
}

function normalizeErrorText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncateError(text: string): string {
  return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH - 1)}…` : text;
}

function parseRetryAfter(value: string | null, nowMs: number): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - nowMs) : undefined;
}

function isPrivateIpv4(a: number, b: number): boolean {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  if (host === "::" || host === "::1") return true;
  if (/^fe[89ab][0-9a-f]:/.test(host)) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;
  if (host.startsWith("::ffff:")) {
    const mapped = host.slice("::ffff:".length);
    const dotted = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(mapped);
    if (dotted) return isPrivateIpv4(Number(dotted[1]), Number(dotted[2]));
    const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(mapped);
    if (hex) {
      const hi = Number.parseInt(hex[1] ?? "0", 16);
      return isPrivateIpv4(hi >> 8, hi & 0xff);
    }
    return true;
  }
  return false;
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
  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const [a, b] = host.split(".").map(Number);
    return !isPrivateIpv4(a ?? 0, b ?? 0);
  }
  if (ipVersion === 6) {
    return !isPrivateIpv6(host);
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
