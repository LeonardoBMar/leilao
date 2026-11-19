import { z } from "zod";

import { createBrowserStore } from "@/lib/browser-store";

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
const store = createBrowserStore<Saved>({ key: STORAGE_KEY, schema: savedSchema, fallback: EMPTY });

export const subscribeLastFilters = store.subscribe;
export const lastFiltersSnapshot = store.getSnapshot;
export const lastFiltersServerSnapshot = store.getServerSnapshot;

/** Guarda a URL da lista visitada (sem a paginação) para o item do menu correspondente. */
export function rememberFilters(pathname: string, search: URLSearchParams) {
  const navHref = REMEMBERED[pathname];
  if (!navHref) return;
  const params = new URLSearchParams(search);
  for (const name of IGNORED_PARAMS) params.delete(name);
  const query = params.toString();
  const target = query ? `${pathname}?${query}` : pathname;

  const current = store.read();
  if (current[navHref] === target) return;
  store.write({ ...current, [navHref]: target });
}

/** Remove os filtros lembrados de um item do menu, voltando ao link padrão. */
export function clearRememberedFilter(navHref: string) {
  const current = store.read();
  if (!(navHref in current)) return;
  const { [navHref]: _removed, ...rest } = current;
  store.write(rest);
}
