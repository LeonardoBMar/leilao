import type { Discovery, SourceAdapter, SourceHttp } from "../types";
import {
  buildLeilaoOnlineListing,
  isLeilaoOnlineLotPage,
  LEILAO_ONLINE_BASE_URL,
  LEILAO_ONLINE_CATEGORY_URL,
  LEILAO_ONLINE_NAME,
  leilaoOnlineAuctionUrl,
  leilaoOnlineDetailsFromRaw,
  leilaoOnlineListingUrl,
  parseLeilaoOnlineAuctionPage,
  parseLeilaoOnlineCategory,
  parseLeilaoOnlineLotPage,
  readLeilaoOnlineRaw,
} from "./parse";
import type { LeilaoOnlineRaw } from "./schema";

/** Teto de páginas por lista (20 lotes cada), contra uma paginação que não termina. */
const MAX_PAGES = 20;

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };
type Category = NonNullable<LeilaoOnlineRaw["category"]>;
/** Lotes do leilão e a categoria de cada um pelo filtro do site; `null` quando o leilão não existe mais. */
type AuctionLots = Map<string, Category | null> | null;
type RunCache = { category: Promise<Outcome<string[]>> | null; auctions: Map<string, Promise<Outcome<AuctionLots>>> };

/**
 * Categoria e listas dos leilões são lidas uma vez por execução e servem a todos os lotes (como no Detran-MG, D-48).
 * A falha de uma lista também fica guardada: o lote segue sem categoria, sem repetir os pedidos, e a próxima execução
 * tenta de novo. A memória fica presa ao `SourceHttp` da execução e some com ele.
 */
const caches = new WeakMap<SourceHttp, RunCache>();

function cacheOf(http: SourceHttp): RunCache {
  const existing = caches.get(http);
  if (existing) return existing;
  const created: RunCache = { category: null, auctions: new Map() };
  caches.set(http, created);
  return created;
}

/**
 * Leilão Online (leilaoonline.com.br, leiloeiros da JUCESP): quinta fonte (docs/PLANO-COLETA.md §2.9, D-50). HTML do
 * servidor, sem anti-robô. A descoberta lê os leilões abertos da categoria "Automóveis" e a lista de cada um; o lote é
 * uma página só, que continua no ar depois do pregão com a situação (vendido, condicional, não vendido) e o último
 * lance. A categoria (carros, motos, caminhões) só aparece como filtro da lista: é lida uma vez e guardada no `raw`.
 */
export const leilaoOnlineSource: SourceAdapter = {
  id: "leilao-online",
  name: LEILAO_ONLINE_NAME,
  baseUrl: LEILAO_ONLINE_BASE_URL,
  usesStoredRaw: true,
  listingUrl: leilaoOnlineListingUrl,
  discover,
  async fetchListing(http, externalId, now, stored) {
    if (!/^\d+$/.test(externalId)) return { ok: false, gone: false, error: `id fora do formato (${externalId})` };

    const response = await http.get(leilaoOnlineListingUrl(externalId));
    if (!response.ok) {
      return { ok: false, gone: response.status === 404 || response.status === 410, error: response.error };
    }
    // O site redireciona o lote que não existe mais para a página inicial.
    if (!isLeilaoOnlineLotPage(response.text)) return { ok: false, gone: true, error: "página do lote fora do ar" };
    // Página de lote sem o que se espera: o site mudou. Falha comum, para a revisita continuar (nunca `gone`).
    const page = parseLeilaoOnlineLotPage(response.text);
    if (page === null) return { ok: false, gone: false, error: "página do lote fora do formato" };
    if (page.lotId !== externalId) return { ok: false, gone: true, error: `página de outro lote (${page.lotId})` };

    const previous = readLeilaoOnlineRaw(stored);
    const category = previous?.lotId === externalId && previous.category ? previous.category : null;
    const raw: LeilaoOnlineRaw = {
      ...page,
      category: category ?? (await categoryOf(http, page.auctionId, page.lotId)),
    };
    return { ok: true, value: buildLeilaoOnlineListing(raw, now) };
  },
  detailsFromRaw: leilaoOnlineDetailsFromRaw,
};

async function discover(http: SourceHttp): Promise<Discovery> {
  const discovery: Discovery = { listings: [], complete: true, errors: [] };
  const auctions = await auctionIdsOf(http);
  if (!auctions.ok) {
    discovery.errors.push({ url: LEILAO_ONLINE_CATEGORY_URL, error: auctions.error });
    return { ...discovery, complete: false };
  }
  for (const auctionId of auctions.value) {
    const lots = await lotsOf(http, auctionId);
    if (!lots.ok) {
      discovery.complete = false;
      discovery.errors.push({ url: leilaoOnlineAuctionUrl(auctionId, 1), error: lots.error });
      continue;
    }
    for (const lotId of lots.value?.keys() ?? []) {
      discovery.listings.push({ externalId: lotId, url: leilaoOnlineListingUrl(lotId), lastModified: null });
    }
  }
  return discovery;
}

function auctionIdsOf(http: SourceHttp): Promise<Outcome<string[]>> {
  const cache = cacheOf(http);
  cache.category ??= (async () => {
    const response = await http.get(LEILAO_ONLINE_CATEGORY_URL);
    if (!response.ok) return { ok: false, error: response.error };
    const ids = parseLeilaoOnlineCategory(response.text);
    return ids === null ? { ok: false, error: "página da categoria sem a lista de leilões" } : { ok: true, value: ids };
  })();
  return cache.category;
}

/**
 * Categoria do lote pelo filtro da lista do leilão. Sem a lista (falha ou leilão removido), o lote fica sem categoria
 * nesta leitura e a próxima tenta de novo: a situação e o lance não esperam por ela.
 */
async function categoryOf(http: SourceHttp, auctionId: string, lotId: string): Promise<Category | null> {
  const lots = await lotsOf(http, auctionId);
  return lots.ok ? (lots.value?.get(lotId) ?? null) : null;
}

function lotsOf(http: SourceHttp, auctionId: string): Promise<Outcome<AuctionLots>> {
  const cache = cacheOf(http);
  let pending = cache.auctions.get(auctionId);
  if (!pending) {
    pending = readAuction(http, auctionId);
    cache.auctions.set(auctionId, pending);
  }
  return pending;
}

/**
 * Lista inteira do leilão e, com mais de uma categoria no filtro, a lista de cada categoria. Com uma categoria só,
 * todos os lotes são dela, sem pedido a mais.
 */
async function readAuction(http: SourceHttp, auctionId: string): Promise<Outcome<AuctionLots>> {
  const all = await readList(http, auctionId, null);
  if (!all.ok || all.value === null) return all.ok ? { ok: true, value: null } : all;
  const lots = new Map<string, Category | null>(all.value.lotIds.map((id) => [id, null]));
  const { categories } = all.value;
  if (categories.length === 1 && categories[0]) {
    const only = categories[0];
    for (const id of lots.keys()) lots.set(id, only);
    return { ok: true, value: lots };
  }
  for (const category of categories) {
    const filtered = await readList(http, auctionId, category.id);
    if (!filtered.ok) return filtered;
    for (const id of filtered.value?.lotIds ?? []) lots.set(id, category);
  }
  return { ok: true, value: lots };
}

type List = { lotIds: string[]; categories: Category[] } | null;

async function readList(http: SourceHttp, auctionId: string, categoryId: string | null): Promise<Outcome<List>> {
  const lotIds = new Set<string>();
  let categories: Category[] = [];
  let lastPage = 1;
  for (let page = 1; page <= Math.min(lastPage, MAX_PAGES); page++) {
    const response = await http.get(leilaoOnlineAuctionUrl(auctionId, page, categoryId));
    if (!response.ok) return { ok: false, error: response.error };
    const parsed = parseLeilaoOnlineAuctionPage(response.text, auctionId);
    // O site redireciona o leilão que não existe para a lista geral.
    if (parsed === null) return page === 1 ? { ok: true, value: null } : { ok: false, error: "lista interrompida" };
    if (page === 1) categories = parsed.categories;
    lastPage = parsed.lastPage;
    for (const id of parsed.lotIds) lotIds.add(id);
  }
  if (lastPage > MAX_PAGES) return { ok: false, error: `lista com ${lastPage} páginas; lidas só ${MAX_PAGES}` };
  return { ok: true, value: { lotIds: [...lotIds], categories } };
}
