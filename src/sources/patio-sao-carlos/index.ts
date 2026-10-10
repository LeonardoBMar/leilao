import type { DiscoveredListing, Discovery, SourceAdapter, SourceHttp } from "../types";
import {
  isPatioPageGone,
  parsePatioEditalAddress,
  parsePatioListing,
  parsePatioLive,
  parsePatioLotList,
  parsePatioRevisit,
  PATIO_BASE_URL,
  PATIO_LIVE_URL,
  PATIO_NAME,
  patioDetailsFromRaw,
  patioEditalUrl,
  patioListingUrl,
  patioListUrl,
} from "./parse";
import type { PatioLiveLot } from "./schema";

/** Categorias do site coletadas: 1 veículos, 2 motocicletas (embarcações, imóveis e equipamentos ficam de fora). */
const CATEGORIES = [1, 2] as const;
/** Teto de páginas por categoria (40 lotes cada), contra uma paginação que não termina. */
const MAX_PAGES = 30;
/** Lotes por consulta interna, para não montar um pedido gigante. */
const LIVE_BATCH = 100;
/**
 * A lista do site mantém lotes encerrados há semanas, mas a página deles sai do ar ("Nenhum Lote Encontrado") em
 * poucos dias. Só entram na descoberta os abertos e os encerrados há até 3 dias, cuja página ainda tem a ficha.
 */
const ENDED_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Pátio Estadual São Carlos (patioestadualsc.org): segunda fonte (docs/PLANO-COLETA.md §2, D-37). Sem sitemap:
 * a descoberta lê as listas por categoria; o lote junta a página (ficha do veículo, fotos) com a consulta interna do
 * site (situação, lance, datas), que responde por vários lotes de uma vez.
 */
export const patioSaoCarlosSource: SourceAdapter = {
  id: "patio-sao-carlos",
  name: PATIO_NAME,
  baseUrl: PATIO_BASE_URL,
  listingUrl: patioListingUrl,
  discover,
  // Revisita só com a consulta de situação (1 requisição em vez de 3): o resto vem do `raw` da última leitura.
  usesStoredRaw: true,
  async fetchListing(http, externalId, now, stored) {
    if (stored !== undefined && stored !== null) {
      const live = await fetchLive(http, [externalId]);
      if (!live.ok) return { ok: false, gone: false, error: live.error };
      const lot = live.lots.get(externalId);
      const revisit = lot ? parsePatioRevisit(stored, lot, now) : null;
      // Fora da consulta (lote retirado?) ou `raw` antigo: a página decide, inclusive se saiu do ar.
      if (revisit) return { ok: true, value: revisit };
    }

    const page = await http.get(patioListingUrl(externalId));
    if (!page.ok) return { ok: false, gone: page.status === 404 || page.status === 410, error: page.error };
    if (isPatioPageGone(page.text)) return { ok: false, gone: true, error: "lote fora do ar no site" };

    const live = await fetchLive(http, [externalId]);
    if (!live.ok) return { ok: false, gone: false, error: live.error };
    const lot = live.lots.get(externalId);
    if (!lot) return { ok: false, gone: false, error: "lote ausente na consulta de situação" };

    // Onde o veículo está só aparece no edital. Se ele falhar, o local fica desconhecido (nunca o da consulta).
    const edital = await http.get(patioEditalUrl(externalId));
    const yardAddress = edital.ok ? parsePatioEditalAddress(edital.text) : null;

    const parsed = parsePatioListing(page.text, lot, yardAddress, now);
    return parsed.ok ? parsed : { ok: false, gone: false, error: parsed.error };
  },
  detailsFromRaw: patioDetailsFromRaw,
};

async function discover(http: SourceHttp, now: Date): Promise<Discovery> {
  const discovery: Discovery = { listings: [], complete: true, errors: [] };
  const found = new Map<string, DiscoveredListing>();

  for (const category of CATEGORIES) {
    let lastPage = 0;
    for (let page = 0; page <= Math.min(lastPage, MAX_PAGES - 1); page++) {
      const url = patioListUrl(category, page);
      const response = await http.get(url);
      if (!response.ok) {
        discovery.complete = false;
        discovery.errors.push({ url, error: response.error });
        break;
      }
      const list = parsePatioLotList(response.text);
      if (page === 0) {
        lastPage = list.lastPage ?? 0;
        // Lista maior que o teto: o que ficar de fora não pode ser lido como "saiu da lista" (goneStatus).
        if (lastPage >= MAX_PAGES) {
          discovery.complete = false;
          discovery.errors.push({ url, error: `lista com ${lastPage + 1} páginas; lidas só ${MAX_PAGES}` });
        }
      }
      const before = found.size;
      for (const listing of list.listings) found.set(listing.externalId, listing);
      // Página além da última repete a anterior: nada novo, fim da lista.
      if (found.size === before) break;
    }
  }

  // Situação de todos de uma vez, para deixar de fora os encerrados cuja página já saiu do ar.
  const live = await fetchLive(http, [...found.keys()]);
  if (!live.ok) {
    discovery.errors.push({ url: PATIO_LIVE_URL, error: live.error });
    return { ...discovery, complete: false };
  }
  discovery.listings = [...found.values()].filter((listing) => {
    const lot = live.lots.get(listing.externalId);
    return lot !== undefined && isRecent(lot, now);
  });
  return discovery;
}

function isRecent(lot: PatioLiveLot, now: Date): boolean {
  const { ano, mes, dia } = lot.cronometro.data.fim;
  const endsOn = Date.UTC(Number(ano), Number(mes) - 1, Number(dia));
  return lot.situacao <= 1 || Number.isNaN(endsOn) || now.getTime() - endsOn <= ENDED_WINDOW_MS;
}

async function fetchLive(
  http: SourceHttp,
  ids: readonly string[],
): Promise<{ ok: true; lots: Map<string, PatioLiveLot> } | { ok: false; error: string }> {
  const lots = new Map<string, PatioLiveLot>();
  for (let start = 0; start < ids.length; start += LIVE_BATCH) {
    // O site separa os ids por hífen, com um no fim ("991-972-").
    const batch = ids.slice(start, start + LIVE_BATCH);
    const response = await http.post(PATIO_LIVE_URL, { leiloes: "", lotes: `${batch.join("-")}-`, lote: "" });
    if (!response.ok) return { ok: false, error: response.error };
    const parsed = parsePatioLive(response.text);
    if (!parsed.ok) return { ok: false, error: `consulta de situação: ${parsed.error}` };
    for (const [id, lot] of parsed.value) lots.set(id, lot);
  }
  return { ok: true, lots };
}
