import type { z } from "zod";

type BrowserStoreOptions<T> = {
  key: string;
  schema: z.ZodType<T>;
  fallback: T;
  normalize?: (value: T) => T;
};

/**
 * Estado persistido no `localStorage` com cache em memória e assinatura compatível com `useSyncExternalStore`.
 * Falhas de leitura ou escrita (SSR, aba privada, cota) caem no estado em memória sem lançar.
 */
export function createBrowserStore<T>({ key, schema, fallback, normalize }: BrowserStoreOptions<T>) {
  let cache: T | null = null;
  const listeners = new Set<() => void>();

  function read(): T {
    if (cache !== null) return cache;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        cache = fallback;
        return cache;
      }
      const parsed = schema.safeParse(JSON.parse(raw));
      const value = parsed.success ? (normalize ? normalize(parsed.data) : parsed.data) : fallback;
      cache = value;
    } catch {
      cache = fallback;
    }
    return cache;
  }

  function write(next: T): void {
    const normalized = normalize ? normalize(next) : next;
    cache = normalized;
    try {
      localStorage.setItem(key, JSON.stringify(normalized));
    } catch {
      // Sem armazenamento (aba privada, bloqueio): vale só nesta sessão da página.
    }
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    read,
    write,
    subscribe,
    getSnapshot: read,
    getServerSnapshot: () => fallback,
  };
}
