import type { Discovery, SourceAdapter, SourceHttp } from "../types";
import {
  buildSuperbidListing,
  parseSuperbidExternalId,
  parseSuperbidList,
  parseSuperbidOffer,
  SUPERBID_BASE_URL,
  SUPERBID_CATEGORY_IDS,
  SUPERBID_MAX_PAGES,
  SUPERBID_NAME,
  SUPERBID_PAGE_SIZE,
  superbidDetailsFromRaw,
  superbidListingUrl,
  superbidListUrl,
  superbidOfferApiUrl,
} from "./parse";

/**
 * Superbid Exchange (exchange.superbid.net): marketplace nacional de leilões corporativos, públicos e judiciais
 * (docs/PLANO-COLETA.md §2.11, D-58). Tudo pela API JSON que o site usa, sem as páginas de categoria (que o
 * `robots.txt` cita). A descoberta pagina os lotes abertos de Carros e de Motos (só o id, o fim e o gerenciador); a
 * oferta vem pelo id, em qualquer situação: depois do fim ela continua na API com o maior lance e o código da situação.
 */
export const superbidSource: SourceAdapter = {
  id: "superbid",
  name: SUPERBID_NAME,
  baseUrl: SUPERBID_BASE_URL,
  listingUrl: superbidListingUrl,
  discover,
  async fetchListing(http, externalId, now) {
    const offerId = parseSuperbidExternalId(externalId);
    if (!offerId) return { ok: false, gone: false, error: `id fora do formato numérico (${externalId})` };
    const response = await http.get(superbidOfferApiUrl(offerId));
    if (!response.ok) return { ok: false, gone: false, error: response.error };
    const parsed = parseSuperbidOffer(response.text, offerId);
    if (!parsed.ok) return { ok: false, gone: false, error: parsed.error };
    if (parsed.value === null) return { ok: false, gone: true, error: "oferta desconhecida pela API" };
    return { ok: true, value: buildSuperbidListing(parsed.value, now) };
  },
  detailsFromRaw: superbidDetailsFromRaw,
};

async function discover(http: SourceHttp, now: Date): Promise<Discovery> {
  const discovery: Discovery = { listings: [], complete: true, errors: [] };
  const seen = new Set<string>();
  for (const categoryId of Object.values(SUPERBID_CATEGORY_IDS)) {
    const outcome = await discoverCategory(http, categoryId, now);
    for (const id of outcome.ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      discovery.listings.push({ externalId: id, url: superbidListingUrl(id), lastModified: null });
    }
    if (outcome.error) {
      discovery.complete = false;
      discovery.errors.push(outcome.error);
    }
  }
  return discovery;
}

/** Todas as páginas de uma categoria. Página com menos ofertas que o tamanho pedido é a última. */
async function discoverCategory(
  http: SourceHttp,
  categoryId: number,
  now: Date,
): Promise<{ ids: string[]; error: { url: string; error: string } | null }> {
  const ids: string[] = [];
  let read = 0;
  for (let page = 1; page <= SUPERBID_MAX_PAGES; page++) {
    const url = superbidListUrl(categoryId, page);
    const response = await http.get(url);
    if (!response.ok) return { ids, error: { url, error: response.error } };
    const parsed = parseSuperbidList(response.text, now);
    if (!parsed.ok) return { ids, error: { url, error: `lista de ofertas: ${parsed.error}` } };
    ids.push(...parsed.value.ids);
    read += parsed.value.count;
    if (parsed.value.count < SUPERBID_PAGE_SIZE || read >= parsed.value.total) return { ids, error: null };
  }
  return {
    ids,
    error: { url: superbidListUrl(categoryId, 1), error: `mais de ${SUPERBID_MAX_PAGES} páginas de ofertas abertas` },
  };
}
