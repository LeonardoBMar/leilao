const STORAGE_KEY = "leilao-mercado-tab-context";

/** Parâmetros compartilhados entre Avaliar e Panorama. */
export const SHARED_MARKET_PARAMS = ["marca", "modelo", "condicao", "anode", "anoate", "kmate"] as const;

export type MarketTabContext = {
  /** Query string dos parâmetros compartilhados (marca, modelo, condicao, anode, anoate, kmate). */
  shared: string;
  /** Query string completa do último recorte do Avaliar (inclui lote, familia, versao, origem, fora). */
  evaluate: string;
};

const EMPTY_CONTEXT: MarketTabContext = { shared: "", evaluate: "" };
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedValue: MarketTabContext = EMPTY_CONTEXT;

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeMarketContext(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function marketContextServerSnapshot(): MarketTabContext {
  return EMPTY_CONTEXT;
}

export function marketContextSnapshot(): MarketTabContext {
  if (typeof window === "undefined") return EMPTY_CONTEXT;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    if (!raw) {
      cachedValue = EMPTY_CONTEXT;
      return cachedValue;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "shared" in parsed &&
      "evaluate" in parsed &&
      typeof parsed.shared === "string" &&
      typeof parsed.evaluate === "string"
    ) {
      cachedValue = { shared: parsed.shared, evaluate: parsed.evaluate };
      return cachedValue;
    }
  } catch {
    // sessionStorage indisponível (modo privado restrito)
  }
  cachedValue = EMPTY_CONTEXT;
  return cachedValue;
}

/** Extrai apenas os parâmetros compartilhados entre Avaliar e Panorama como query string. */
export function pickSharedQuery(params: Readonly<Record<string, string>> | URLSearchParams): string {
  const next = new URLSearchParams();
  for (const key of SHARED_MARKET_PARAMS) {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    if (value) next.set(key, value);
  }
  return next.toString();
}

/** Registra o recorte resolvido atual para preservar contexto ao alternar entre Avaliar, Panorama e Calibração. */
export function rememberMarketContext(patch: Partial<MarketTabContext>): void {
  if (typeof window === "undefined") return;
  const current = marketContextSnapshot();
  const next: MarketTabContext = {
    shared: patch.shared ?? current.shared,
    evaluate: patch.evaluate ?? current.evaluate,
  };
  if (next.shared === current.shared && next.evaluate === current.evaluate) return;
  try {
    const raw = JSON.stringify(next);
    window.sessionStorage.setItem(STORAGE_KEY, raw);
    cachedRaw = raw;
    cachedValue = next;
    emit();
  } catch {
    // sessionStorage indisponível
  }
}
