import type { Discovery, SourceAdapter, SourceHttp } from "../types";
import {
  buildLeiloesPbListing,
  LEILOES_PB_BASE_URL,
  LEILOES_PB_HOME_URL,
  LEILOES_PB_NAME,
  leiloesPbAuctionUrl,
  leiloesPbDetailsFromRaw,
  leiloesPbListingUrl,
  parseLeiloesPbAuctionPage,
  parseLeiloesPbHome,
  parseLeiloesPbLotPage,
} from "./parse";

/** Teto de páginas por evento (48 lotes cada), contra uma paginação que não termina. */
const MAX_PAGES = 10;

/**
 * Leilões PB (leiloespb.com.br, plataforma Suporte Leilões): oitava fonte, a primeira do Nordeste
 * (docs/PLANO-COLETA.md §2.7, D-67). HTML do servidor, sem anti-robô. A descoberta lê os eventos da página inicial e a
 * lista de lotes de cada um, só os de veículo; o lote é uma página só, com o estado num JSON embutido (`var lote`), que
 * continua no ar depois do pregão com a situação e o valor do arremate.
 */
export const leiloesPbSource: SourceAdapter = {
  id: "leiloes-pb",
  name: LEILOES_PB_NAME,
  baseUrl: LEILOES_PB_BASE_URL,
  listingUrl: leiloesPbListingUrl,
  discover,
  async fetchListing(http, externalId, now) {
    if (!/^\d+$/.test(externalId)) return { ok: false, gone: false, error: `id fora do formato (${externalId})` };

    const response = await http.get(leiloesPbListingUrl(externalId));
    if (!response.ok) {
      return { ok: false, gone: response.status === 404 || response.status === 410, error: response.error };
    }
    // Página de lote sem o que se espera: o site mudou. Falha comum, para a revisita continuar (nunca `gone`).
    const raw = parseLeiloesPbLotPage(response.text);
    if (raw === null) return { ok: false, gone: false, error: "página do lote fora do formato" };
    if (raw.lotId !== externalId) return { ok: false, gone: true, error: `página de outro lote (${raw.lotId})` };
    return { ok: true, value: buildLeiloesPbListing(raw, now) };
  },
  detailsFromRaw: leiloesPbDetailsFromRaw,
};

async function discover(http: SourceHttp): Promise<Discovery> {
  const discovery: Discovery = { listings: [], complete: true, errors: [] };
  const home = await http.get(LEILOES_PB_HOME_URL);
  const auctionIds = home.ok ? parseLeiloesPbHome(home.text) : null;
  if (auctionIds === null) {
    discovery.errors.push({
      url: LEILOES_PB_HOME_URL,
      error: home.ok ? "página inicial sem a lista de eventos" : home.error,
    });
    return { ...discovery, complete: false };
  }
  for (const auctionId of auctionIds) {
    const lots = await readAuction(http, auctionId);
    if (!lots.ok) {
      discovery.complete = false;
      discovery.errors.push({ url: lots.url, error: lots.error });
      continue;
    }
    for (const lotId of lots.value) {
      discovery.listings.push({ externalId: lotId, url: leiloesPbListingUrl(lotId), lastModified: null });
    }
  }
  return discovery;
}

type AuctionLots = { ok: true; value: string[] } | { ok: false; url: string; error: string };

async function readAuction(http: SourceHttp, auctionId: string): Promise<AuctionLots> {
  const lotIds = new Set<string>();
  let lastPage = 1;
  for (let page = 1; page <= Math.min(lastPage, MAX_PAGES); page++) {
    const url = leiloesPbAuctionUrl(auctionId, page);
    const response = await http.get(url);
    if (!response.ok) return { ok: false, url, error: response.error };
    const parsed = parseLeiloesPbAuctionPage(response.text, auctionId);
    if (parsed === null) return { ok: false, url, error: "página do evento fora do formato" };
    lastPage = parsed.lastPage;
    for (const id of parsed.lotIds) lotIds.add(id);
  }
  if (lastPage > MAX_PAGES) {
    return {
      ok: false,
      url: leiloesPbAuctionUrl(auctionId, 1),
      error: `evento com ${lastPage} páginas; lidas só ${MAX_PAGES}`,
    };
  }
  return { ok: true, value: [...lotIds] };
}
