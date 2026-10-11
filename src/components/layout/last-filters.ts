import { z } from "zod";

/**
 * Últimos filtros de cada lista, para o menu voltar à mesma busca (D-55). Fica no `localStorage` deste navegador:
 * é conveniência, então qualquer falha de leitura ou escrita cai no link padrão.
 */
const STORAGE_KEY = "leilao:last-filters";

/** Páginas lembradas e o item do menu a que pertencem. */
const REMEMBERED: Readonly<Record<string, string>> = {
  "/leiloes": "/leiloes",
  "/leiloes/veiculos": "/leiloes",
  "/minhas-analises": "/minhas-analises",
  "/alertas": "/alertas",
  "/mercado": "/mercado",
  "/mercado/panorama": "/mercado",
};

/** A página atual não entra no que é lembrado. */
const IGNORED_PARAMS = ["pagina"];

const savedSchema = z.record(z.string(), z.string());
type Saved = Readonly<Record<string, string>>;

const EMPTY: Saved = {};
let cache: Saved | null = null;
const listeners = new Set<() => void>();

function read(): Saved {
  if (cache) return cache;
  try {
    const parsed = savedSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
    cache = parsed.success ? parsed.data : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

export function subscribeLastFilters(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const lastFiltersSnapshot = read;
export const lastFiltersServerSnapshot = () => EMPTY;

/** Guarda a URL da lista visitada (sem a paginação) para o item do menu correspondente. */
export function rememberFilters(pathname: string, search: URLSearchParams) {
  const navHref = REMEMBERED[pathname];
  if (!navHref) return;
  const params = new URLSearchParams(search);
  for (const name of IGNORED_PARAMS) params.delete(name);
  const query = params.toString();
  const target = query ? `${pathname}?${query}` : pathname;

  const current = read();
  if (current[navHref] === target) return;
  cache = { ...current, [navHref]: target };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Sem armazenamento (aba privada, bloqueio): vale só nesta sessão da página.
  }
  for (const listener of listeners) listener();
}
