import type { Discovery, SourceAdapter, SourceHttp } from "../types";
import {
  buildSuperbidListing,
  parseSuperbidClosedList,
  parseSuperbidExternalId,
  parseSuperbidList,
  parseSuperbidOffer,
  SUPERBID_BASE_URL,
  SUPERBID_CATEGORY_IDS,
  SUPERBID_MAX_PAGES,
  SUPERBID_NAME,
  SUPERBID_PAGE_SIZE,
  superbidClosedListUrl,
  superbidDetailsFromRaw,
  type SuperbidListedOffer,
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

/**
 * Os abertos das duas categorias, **do fim mais próximo para o mais distante** (sem fim informado por último): o
 * coletor visita os novos na ordem da lista, até o limite da execução, e o lote que encerra antes da primeira visita
 * sai da lista e nunca seria gravado.
 */
async function discover(http: SourceHttp, now: Date): Promise<Discovery> {
  const discovery: Discovery = { listings: [], complete: true, errors: [] };
  const offers = new Map<string, SuperbidListedOffer>();
  for (const categoryId of Object.values(SUPERBID_CATEGORY_IDS)) {
    const outcome = await discoverCategory(http, categoryId, now);
    for (const offer of outcome.offers) offers.set(offer.id, offer);
    if (outcome.error) {
      discovery.complete = false;
      discovery.errors.push(outcome.error);
    }
  }
  const byEnd = [...offers.values()].sort(
    (a, b) => (a.endsAt ?? Number.POSITIVE_INFINITY) - (b.endsAt ?? Number.POSITIVE_INFINITY),
  );
  for (const { id } of byEnd)
    discovery.listings.push({ externalId: id, url: superbidListingUrl(id), lastModified: null });
  return discovery;
}

type ListError = { url: string; error: string };

/** Todas as páginas de uma categoria. Página com menos ofertas que o tamanho pedido é a última. */
async function discoverCategory(
  http: SourceHttp,
  categoryId: number,
  now: Date,
): Promise<{ offers: SuperbidListedOffer[]; error: ListError | null }> {
  const offers: SuperbidListedOffer[] = [];
  let read = 0;
  for (let page = 1; page <= SUPERBID_MAX_PAGES; page++) {
    const url = superbidListUrl(categoryId, page);
    const response = await http.get(url);
    if (!response.ok) return { offers, error: { url, error: response.error } };
    const parsed = parseSuperbidList(response.text, now);
    if (!parsed.ok) return { offers, error: { url, error: `lista de ofertas: ${parsed.error}` } };
    offers.push(...parsed.value.offers);
    read += parsed.value.count;
    if (parsed.value.count < SUPERBID_PAGE_SIZE || read >= parsed.value.total) return { offers, error: null };
  }
  return {
    offers,
    error: { url: superbidListUrl(categoryId, 1), error: `mais de ${SUPERBID_MAX_PAGES} páginas de ofertas abertas` },
  };
}

/**
 * Ids dos lotes de Carros e Motos encerrados desde `since`, para a carga avulsa (`scripts/superbid-backfill.ts`): não
 * faz parte da coleta agendada, que só descobre abertos e grava o desfecho na revisita. Pagina do id mais novo para o
 * mais antigo até uma página inteira ficar fora da janela (ou o limite de páginas da API).
 */
export async function discoverRecentlyClosed(
  http: SourceHttp,
  since: Date,
): Promise<{ ids: string[]; error: ListError | null }> {
  const ids = new Set<string>();
  let read = 0;
  for (let page = 1; page <= SUPERBID_MAX_PAGES; page++) {
    const url = superbidClosedListUrl(page);
    const response = await http.get(url);
    if (!response.ok) return { ids: [...ids], error: { url, error: response.error } };
    const parsed = parseSuperbidClosedList(response.text, since);
    if (!parsed.ok) return { ids: [...ids], error: { url, error: `lista de encerrados: ${parsed.error}` } };
    for (const id of parsed.value.ids) ids.add(id);
    read += parsed.value.count;
    if (parsed.value.older || parsed.value.count < SUPERBID_PAGE_SIZE || read >= parsed.value.total) {
      return { ids: [...ids], error: null };
    }
  }
  return {
    ids: [...ids],
    error: { url: superbidClosedListUrl(1), error: `mais de ${SUPERBID_MAX_PAGES} páginas de encerrados na janela` },
  };
}
