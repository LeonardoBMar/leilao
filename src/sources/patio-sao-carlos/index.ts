import type { DiscoveredListing, Discovery, SourceAdapter, SourceHttp } from "../types";
import {
  parsePatioEditalAddress,
  parsePatioListing,
  parsePatioLotList,
  PATIO_BASE_URL,
  PATIO_NAME,
  patioDetailsFromRaw,
  patioEditalUrl,
  patioListingUrl,
  patioListUrl,
  storedYardAddressFor,
} from "./parse";
import type { PatioListItem } from "./schema";

/** Categorias coletadas: 1 veículos, 2 motocicletas (embarcações, imóveis e equipamentos ficam de fora). */
const CATEGORIES = [1, 2] as const;
/** Teto de páginas por categoria (12 lotes cada), contra uma paginação que não termina. */
const MAX_PAGES = 30;
/**
 * A lista do site mantém lotes encerrados há semanas, mas páginas antigas podem sair do ar (404).
 * Só entram na descoberta os abertos/condicionais e os encerrados há até 3 dias.
 */
const ENDED_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Pátio Estadual São Carlos (patioestadualsc.org): site em Next.js App Router.
 * A descoberta lê `initialLotes` nas listas paginadas por categoria; cada lote lê `initialLote` e `initialLeilao`
 * diretamente em `/lote/{id}/` e busca o endereço do pátio no edital na primeira visita (reaproveitado em revisitas).
 */
export const patioSaoCarlosSource: SourceAdapter = {
  id: "patio-sao-carlos",
  name: PATIO_NAME,
  baseUrl: PATIO_BASE_URL,
  listingUrl: patioListingUrl,
  discover,
  usesStoredRaw: true,
  async fetchListing(http, externalId, now, stored) {
    const page = await http.get(patioListingUrl(externalId));
    if (!page.ok) return { ok: false, gone: page.status === 404 || page.status === 410, error: page.error };

    let yardAddress = storedYardAddressFor(stored, externalId);
    if (yardAddress === null) {
      const edital = await http.get(patioEditalUrl(externalId));
      yardAddress = edital.ok ? parsePatioEditalAddress(edital.text) : null;
    }

    const parsed = parsePatioListing(page.text, yardAddress, now);
    return parsed.ok ? parsed : { ok: false, gone: false, error: parsed.error };
  },
  detailsFromRaw: patioDetailsFromRaw,
};

async function discover(http: SourceHttp, now: Date): Promise<Discovery> {
  const discovery: Discovery = { listings: [], complete: true, errors: [] };
  const found = new Map<string, DiscoveredListing>();

  for (const category of CATEGORIES) {
    let totalPages = 1;
    for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
      const url = patioListUrl(category, page);
      const response = await http.get(url);
      if (!response.ok) {
        discovery.complete = false;
        discovery.errors.push({ url, error: response.error });
        break;
      }
      const list = parsePatioLotList(response.text);
      if (!list.ok) {
        discovery.complete = false;
        discovery.errors.push({ url, error: `lista de lotes: ${list.error}` });
        break;
      }
      if (page === 1) {
        totalPages = list.value.totalPages;
        if (totalPages > MAX_PAGES) {
          discovery.complete = false;
          discovery.errors.push({ url, error: `lista com ${totalPages} páginas; lidas só ${MAX_PAGES}` });
        }
      }
      let added = 0;
      for (const item of list.value.items) {
        if (!isRecent(item, now)) continue;
        if (!found.has(item.id)) {
          found.set(item.id, { externalId: item.id, url: patioListingUrl(item.id), lastModified: null });
          added++;
        }
      }
      if (list.value.items.length === 0 || (added === 0 && list.value.items.every((item) => found.has(item.id)))) break;
    }
  }

  discovery.listings = [...found.values()];
  return discovery;
}

function isRecent(item: PatioListItem, now: Date): boolean {
  if (item.status !== "CLOSED") return true;
  if (!item.fechamentoIso) return true;
  const endsAt = new Date(item.fechamentoIso);
  return Number.isNaN(endsAt.getTime()) || now.getTime() - endsAt.getTime() <= ENDED_WINDOW_MS;
}
