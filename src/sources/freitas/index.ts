import type { DiscoveredListing, Discovery, SourceAdapter, SourceHttp } from "../types";
import {
  buildFreitasListing,
  FREITAS_AGENDA_URL,
  FREITAS_BASE_URL,
  FREITAS_CONDITION_ORDER,
  FREITAS_CONDITIONS,
  FREITAS_NAME,
  FREITAS_PAGE_SIZE,
  FREITAS_YARDS,
  type FreitasCard,
  freitasDetailsFromRaw,
  freitasExternalId,
  type FreitasFilter,
  freitasListingUrl,
  freitasListUrl,
  type FreitasPage,
  freitasPhotosUrl,
  freitasTypesUrl,
  isFreitasOpen,
  isVehicleAuction,
  parseFreitasAgenda,
  parseFreitasCards,
  parseFreitasExternalId,
  parseFreitasPage,
  parseFreitasPhotos,
  parseFreitasTypes,
} from "./parse";

/** Teto de páginas por consulta (100 lotes cada), contra uma paginação que não termina. */
const MAX_PAGES = 20;

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };
/** O que os filtros da lista dizem de cada lote do leilão. */
type Labels = {
  damage: Map<number, (typeof FREITAS_CONDITIONS)[(typeof FREITAS_CONDITION_ORDER)[number]]>;
  yard: Map<number, number>;
  type: Map<number, string>;
};
type AuctionCache = {
  cards: Map<string, Promise<Outcome<Map<number, FreitasCard>>>>;
  labels: Map<string, Promise<Outcome<Labels>>>;
};

/**
 * A lista de um leilão (cartões e filtros) é lida uma vez por execução e serve a todos os lotes dele: cada lote
 * sairia da página do lote e de 5 a 10 consultas filtradas. A memória fica presa ao `SourceHttp` da execução e some
 * com ele; a execução seguinte lê de novo (D-40).
 */
const caches = new WeakMap<SourceHttp, AuctionCache>();

/**
 * Freitas Leiloeiro (freitasleiloeiro.com.br): terceira fonte (docs/PLANO-COLETA.md §2.2, D-40). HTML do servidor,
 * sem anti-robô. A descoberta lê a agenda e a lista dos leilões de veículos (pátios); o lote junta o cartão da lista
 * (situação, lance, data), os filtros do site (monta, pátio, tipo), a página do lote enquanto ele está aberto
 * (custos, observações) e a lista de fotos. Depois da venda a página do lote dá erro, mas o cartão continua na lista.
 */
export const freitasSource: SourceAdapter = {
  id: "freitas",
  name: FREITAS_NAME,
  baseUrl: FREITAS_BASE_URL,
  listingUrl: freitasListingUrl,
  discover,
  async fetchListing(http, externalId, now) {
    const id = parseFreitasExternalId(externalId);
    if (!id) return { ok: false, gone: false, error: `id fora do formato leilão-lote (${externalId})` };

    const cards = await cardsOf(http, id.auctionId);
    if (!cards.ok) return { ok: false, gone: false, error: cards.error };
    const card = cards.value.get(id.lotNumber);
    // Lote fora da lista do leilão (leilão removido ou lote tirado): página fora do ar.
    if (!card) return { ok: false, gone: true, error: "lote fora da lista do leilão" };

    const labels = await labelsOf(http, id.auctionId);
    if (!labels.ok) return { ok: false, gone: false, error: labels.error };

    // A página do lote só vale a requisição enquanto ele está aberto: depois da venda o site responde erro 500.
    let page: FreitasPage | null = null;
    if (isFreitasOpen(card)) {
      const response = await http.get(freitasListingUrl(externalId));
      if (!response.ok) return { ok: false, gone: false, error: response.error };
      page = parseFreitasPage(response.text);
      if (!page) return { ok: false, gone: false, error: "página do lote fora do formato" };
    }

    const photos = await http.get(freitasPhotosUrl(id.auctionId, id.lotNumber));
    const raw = {
      auctionId: id.auctionId,
      card,
      damage: labels.value.damage.get(id.lotNumber) ?? null,
      typeName: labels.value.type.get(id.lotNumber) ?? null,
      yardId: labels.value.yard.get(id.lotNumber) ?? null,
      page,
    };
    return { ok: true, value: buildFreitasListing(raw, photos.ok ? parseFreitasPhotos(photos.text) : [], now) };
  },
  detailsFromRaw: freitasDetailsFromRaw,
};

async function discover(http: SourceHttp): Promise<Discovery> {
  const discovery: Discovery = { listings: [], complete: true, errors: [] };
  const agenda = await http.get(FREITAS_AGENDA_URL);
  if (!agenda.ok) {
    return { ...discovery, complete: false, errors: [{ url: FREITAS_AGENDA_URL, error: agenda.error }] };
  }

  const found = new Map<string, DiscoveredListing>();
  for (const auction of parseFreitasAgenda(agenda.text).filter(isVehicleAuction)) {
    const cards = await cardsOf(http, auction.auctionId);
    if (!cards.ok) {
      discovery.complete = false;
      discovery.errors.push({ url: freitasListUrl(auction.auctionId, { kind: "all" }, 1), error: cards.error });
      continue;
    }
    for (const lotNumber of cards.value.keys()) {
      const externalId = freitasExternalId(auction.auctionId, lotNumber);
      found.set(externalId, { externalId, url: freitasListingUrl(externalId), lastModified: null });
    }
  }
  discovery.listings = [...found.values()];
  return discovery;
}

function cacheOf(http: SourceHttp): AuctionCache {
  let cache = caches.get(http);
  if (!cache) {
    cache = { cards: new Map(), labels: new Map() };
    caches.set(http, cache);
  }
  return cache;
}

/** Lembra o resultado por leilão nesta execução; falha não fica guardada (o próximo lote tenta de novo). */
function remember<T>(store: Map<string, Promise<Outcome<T>>>, key: string, load: () => Promise<Outcome<T>>) {
  const cached = store.get(key);
  if (cached) return cached;
  const loading = load().then((outcome) => {
    if (!outcome.ok) store.delete(key);
    return outcome;
  });
  store.set(key, loading);
  return loading;
}

function cardsOf(http: SourceHttp, auctionId: string) {
  return remember(cacheOf(http).cards, auctionId, async () => {
    const cards = await readList(http, auctionId, { kind: "all" });
    return cards.ok ? { ok: true, value: new Map(cards.value.map((card) => [card.lotNumber, card])) } : cards;
  });
}

function labelsOf(http: SourceHttp, auctionId: string) {
  return remember(cacheOf(http).labels, auctionId, async (): Promise<Outcome<Labels>> => {
    const labels: Labels = { damage: new Map(), yard: new Map(), type: new Map() };

    // Do mais grave para o menos: lote em dois filtros fica com o mais grave.
    for (const condition of FREITAS_CONDITION_ORDER) {
      const level = FREITAS_CONDITIONS[condition];
      const cards = await readList(http, auctionId, { kind: "condition", value: condition });
      if (!cards.ok) return cards;
      for (const card of cards.value) if (!labels.damage.has(card.lotNumber)) labels.damage.set(card.lotNumber, level);
    }
    for (const yardId of Object.keys(FREITAS_YARDS).map(Number)) {
      const cards = await readList(http, auctionId, { kind: "yard", value: yardId });
      if (!cards.ok) return cards;
      for (const card of cards.value) labels.yard.set(card.lotNumber, yardId);
    }
    const types = await http.get(freitasTypesUrl(auctionId));
    if (!types.ok) return { ok: false, error: `tipos de lote: ${types.error}` };
    for (const type of parseFreitasTypes(types.text)) {
      const cards = await readList(http, auctionId, { kind: "type", value: type.id });
      if (!cards.ok) return cards;
      for (const card of cards.value) labels.type.set(card.lotNumber, type.name);
    }
    return { ok: true, value: labels };
  });
}

/** Todas as páginas de uma consulta da lista. Página com menos de 100 lotes é a última. */
async function readList(http: SourceHttp, auctionId: string, filter: FreitasFilter): Promise<Outcome<FreitasCard[]>> {
  const cards: FreitasCard[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = freitasListUrl(auctionId, filter, page);
    const response = await http.get(url);
    if (!response.ok) return { ok: false, error: `lista do leilão ${auctionId}: ${response.error}` };
    const found = parseFreitasCards(response.text);
    cards.push(...found);
    if (found.length < FREITAS_PAGE_SIZE) return { ok: true, value: cards };
  }
  return { ok: false, error: `lista do leilão ${auctionId} com mais de ${MAX_PAGES} páginas` };
}
