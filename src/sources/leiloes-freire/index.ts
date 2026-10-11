import type { Discovery, SourceAdapter, SourceHttp } from "../types";
import {
  buildLeiloesFreireListing,
  firstLotOfAuctionPage,
  isFreireVehicle,
  LEILOES_FREIRE_AUCTIONS_URL,
  LEILOES_FREIRE_BASE_URL,
  LEILOES_FREIRE_NAME,
  leiloesFreireAuctionUrl,
  leiloesFreireDetailsFromRaw,
  leiloesFreireListingUrl,
  parseLeiloesFreireAuctions,
  parseLeiloesFreireLotPage,
} from "./parse";
import type { FreireRaw } from "./schema";

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * A página de qualquer lote traz o leilão inteiro (até ~350 lotes, ~1,4 MB no Detran-AL): é lida uma vez por execução
 * e serve a todos os lotes dele. A memória fica presa ao `SourceHttp` da execução e some com ele.
 */
const caches = new WeakMap<SourceHttp, Map<string, FreireRaw>>();

function cacheOf(http: SourceHttp): Map<string, FreireRaw> {
  const existing = caches.get(http);
  if (existing) return existing;
  const created = new Map<string, FreireRaw>();
  caches.set(http, created);
  return created;
}

/**
 * Leilões Freire (leiloesfreire.com.br, leiloeiro de Alagoas com leilões em AL, PE e SE): nona fonte
 * (docs/PLANO-COLETA.md §2.12, D-68). Leilões do Detran-AL, de prefeituras e de empresas. HTML do servidor, sem
 * anti-robô. A descoberta lê a lista de leilões abertos, a página de cada um e a de um lote dele, que traz todos os
 * lotes com a situação e o último lance; ficam só os lotes de veículo. Depois do pregão o lote continua no ar com
 * "Vendido" e o valor da venda.
 */
export const leiloesFreireSource: SourceAdapter = {
  id: "leiloes-freire",
  name: LEILOES_FREIRE_NAME,
  baseUrl: LEILOES_FREIRE_BASE_URL,
  listingUrl: leiloesFreireListingUrl,
  discover,
  async fetchListing(http, externalId, now) {
    if (!/^\d+$/.test(externalId)) return { ok: false, gone: false, error: `id fora do formato (${externalId})` };
    const cached = cacheOf(http).get(externalId);
    if (cached) return { ok: true, value: buildLeiloesFreireListing(cached, now) };

    const read = await readLotPage(http, externalId);
    if (!read.ok) return { ok: false, gone: read.gone, error: read.error };
    const raw = cacheOf(http).get(externalId);
    if (!raw) return { ok: false, gone: true, error: "lote fora do leilão da própria página" };
    return { ok: true, value: buildLeiloesFreireListing(raw, now) };
  },
  detailsFromRaw: leiloesFreireDetailsFromRaw,
};

async function discover(http: SourceHttp): Promise<Discovery> {
  const discovery: Discovery = { listings: [], complete: true, errors: [] };
  const list = await http.get(LEILOES_FREIRE_AUCTIONS_URL);
  const auctionIds = list.ok ? parseLeiloesFreireAuctions(list.text) : null;
  if (auctionIds === null) {
    const error = list.ok ? "página sem a lista de leilões" : list.error;
    discovery.errors.push({ url: LEILOES_FREIRE_AUCTIONS_URL, error });
    return { ...discovery, complete: false };
  }
  for (const auctionId of auctionIds) {
    const lots = await lotsOfAuction(http, auctionId);
    if (!lots.ok) {
      discovery.complete = false;
      discovery.errors.push({ url: leiloesFreireAuctionUrl(auctionId), error: lots.error });
      continue;
    }
    for (const lot of lots.value) {
      if (!isFreireVehicle(lot.description)) continue;
      discovery.listings.push({ externalId: lot.lotId, url: leiloesFreireListingUrl(lot.lotId), lastModified: null });
    }
  }
  return discovery;
}

/** Lotes de um leilão (todos, de veículo ou não), pela página do leilão e a do primeiro lote. */
export async function lotsOfAuction(http: SourceHttp, auctionId: string): Promise<Outcome<FreireRaw[]>> {
  const page = await http.get(leiloesFreireAuctionUrl(auctionId));
  if (!page.ok) return { ok: false, error: page.error };
  const firstLot = firstLotOfAuctionPage(page.text);
  if (firstLot === null) return { ok: true, value: [] };
  const read = await readLotPage(http, firstLot);
  if (!read.ok) return { ok: false, error: read.error };
  return { ok: true, value: read.value.filter((lot) => lot.auctionId === auctionId) };
}

type LotPage = { ok: true; value: FreireRaw[] } | { ok: false; gone: boolean; error: string };

async function readLotPage(http: SourceHttp, lotId: string): Promise<LotPage> {
  const response = await http.get(leiloesFreireListingUrl(lotId));
  if (!response.ok)
    return { ok: false, gone: response.status === 404 || response.status === 410, error: response.error };
  // Página de lote sem o leilão: o site mudou. Falha comum, para a revisita continuar (nunca `gone`).
  const lots = parseLeiloesFreireLotPage(response.text);
  if (lots === null) return { ok: false, gone: false, error: "página do lote fora do formato" };
  const cache = cacheOf(http);
  for (const lot of lots) cache.set(lot.lotId, lot);
  return { ok: true, value: lots };
}
