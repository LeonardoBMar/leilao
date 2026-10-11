import type { Discovery, SourceAdapter, SourceHttp } from "../types";
import {
  buildLanceCertoListing,
  isLanceCertoVehicleCard,
  LANCE_CERTO_BASE_URL,
  LANCE_CERTO_NAME,
  lanceCertoAuctionUrl,
  lanceCertoDetailsFromRaw,
  lanceCertoExternalId,
  lanceCertoHomeUrl,
  lanceCertoListingUrl,
  parseLanceCertoAuctionPage,
  parseLanceCertoHome,
  parseLanceCertoLotPage,
  splitLanceCertoExternalId,
} from "./parse";

/** Teto de páginas da lista de leilões (2 em 11/10/2026), contra laço se o site devolver um total errado. */
const MAX_HOME_PAGES = 10;
/** Teto de páginas de um leilão (32 lotes cada; o maior de 11/10/2026, de imóveis da Caixa, tinha 18). */
const MAX_AUCTION_PAGES = 40;

/**
 * UF de cada leilão já lido na execução: a página do lote não a traz, a do leilão sim. Presa ao `SourceHttp` da
 * execução, some com ele.
 */
const auctionStates = new WeakMap<SourceHttp, Map<string, string | null>>();

function statesOf(http: SourceHttp): Map<string, string | null> {
  const existing = auctionStates.get(http);
  if (existing) return existing;
  const created = new Map<string, string | null>();
  auctionStates.set(http, created);
  return created;
}

/**
 * Lance Certo Leilões (lancecertoleiloes.com.br, loja da plataforma VIP Leilões, leiloeiros de Recife e Natal): décima
 * fonte (docs/PLANO-COLETA.md §2.13, D-69). Leilões da PRF-PE, dos Detrans de PE e RN, de prefeituras e da Justiça.
 * HTML do servidor (ASP.NET), sem anti-robô. A descoberta lê a lista de leilões abertos e futuros (JSON), as páginas
 * de cada leilão e fica com os cartões de veículo; o lote é lido na página dele, que continua no ar depois do pregão
 * com "Encerrado" e o valor vencedor.
 */
export const lanceCertoSource: SourceAdapter = {
  id: "lance-certo",
  name: LANCE_CERTO_NAME,
  baseUrl: LANCE_CERTO_BASE_URL,
  listingUrl: lanceCertoListingUrl,
  discover,
  async fetchListing(http, externalId, now) {
    const id = splitLanceCertoExternalId(externalId);
    if (!id) return { ok: false, gone: false, error: `id fora do formato (${externalId})` };
    const response = await http.get(lanceCertoListingUrl(externalId));
    if (!response.ok) {
      return { ok: false, gone: response.status === 404 || response.status === 410, error: response.error };
    }
    const page = parseLanceCertoLotPage(response.text, id.edital, id.lotId);
    if (page === "gone") return { ok: false, gone: true, error: "página do lote vazia" };
    // Página sem os campos do lote: o site mudou. Falha comum, para a revisita continuar (nunca `gone`).
    if (page === null) return { ok: false, gone: false, error: "página do lote fora do formato" };
    const auctionState = await auctionStateOf(http, id.edital);
    return { ok: true, value: buildLanceCertoListing({ ...page, auctionState }, now) };
  },
  detailsFromRaw: lanceCertoDetailsFromRaw,
};

async function discover(http: SourceHttp): Promise<Discovery> {
  const discovery: Discovery = { listings: [], complete: true, errors: [] };
  const editais: string[] = [];
  for (let page = 1, pages = 1; page <= Math.min(pages, MAX_HOME_PAGES); page++) {
    const url = lanceCertoHomeUrl(page);
    const response = await http.get(url);
    const home = response.ok ? parseLanceCertoHome(response.text) : null;
    if (home === null) {
      discovery.errors.push({ url, error: response.ok ? "lista de leilões fora do formato" : response.error });
      return { ...discovery, complete: false };
    }
    pages = home.pages;
    editais.push(...home.editais.filter((edital) => !editais.includes(edital)));
  }

  for (const edital of editais) {
    for (let page = 1, lastPage = 1; page <= Math.min(lastPage, MAX_AUCTION_PAGES); page++) {
      const url = lanceCertoAuctionUrl(edital, page);
      const response = await http.get(url);
      const auction = response.ok ? parseLanceCertoAuctionPage(response.text, edital) : null;
      if (auction === null) {
        discovery.complete = false;
        discovery.errors.push({ url, error: response.ok ? "página do leilão fora do formato" : response.error });
        break;
      }
      if (page === 1) statesOf(http).set(edital, auction.state);
      lastPage = auction.lastPage;
      for (const card of auction.cards.filter(isLanceCertoVehicleCard)) {
        const externalId = lanceCertoExternalId(edital, card.lotId);
        discovery.listings.push({ externalId, url: lanceCertoListingUrl(externalId), lastModified: null });
      }
      // Leilão só de imóveis (Caixa): as outras páginas também são.
      if (auction.cards.length > 0 && auction.cards.every((card) => /^IM[ÓO]VE/i.test(card.category))) break;
    }
  }
  return discovery;
}

/** UF do leilão, da página dele (uma vez por execução). Falha na leitura deixa o lote sem UF, não o perde. */
async function auctionStateOf(http: SourceHttp, edital: string): Promise<string | null> {
  const states = statesOf(http);
  const known = states.get(edital);
  if (known !== undefined) return known;
  const response = await http.get(lanceCertoAuctionUrl(edital));
  const state = response.ok ? (parseLanceCertoAuctionPage(response.text, edital)?.state ?? null) : null;
  states.set(edital, state);
  return state;
}
