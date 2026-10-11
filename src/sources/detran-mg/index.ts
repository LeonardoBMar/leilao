import type { Discovery, SourceAdapter, SourceHttp } from "../types";
import {
  buildDetranListing,
  DETRAN_MG_BASE_URL,
  DETRAN_MG_NAME,
  type DetranAuction,
  type DetranAuctionRef,
  detranAuctionUrl,
  type DetranCard,
  detranClosesAt,
  detranDetailsFromRaw,
  detranExternalId,
  detranListingUrl,
  detranLiveUrl,
  detranLotUrl,
  type DetranRaw,
  parseDetranAuctionPage,
  parseDetranExternalId,
  parseDetranHome,
  parseDetranLive,
  parseDetranLotPage,
  readDetranRaw,
  snapshotLive,
} from "./parse";
import type { DetranLiveLot } from "./schema";

/** Teto de páginas por leilão (100 lotes cada), contra uma paginação que não termina. */
const MAX_PAGES = 20;
/** Lotes por consulta de situação, para não montar uma URL gigante. */
const LIVE_BATCH = 100;

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };
/** Lista de um leilão aberto; `null` quando o site já não a mostra (leilão encerrado redireciona ao início). */
type AuctionList = { auction: DetranAuction; cards: Map<string, DetranCard> } | null;
type RunCache = {
  home: Promise<Outcome<Map<string, DetranAuctionRef>>> | null;
  lists: Map<string, Promise<Outcome<AuctionList>>>;
  live: Map<string, DetranLiveLot>;
};

/**
 * Início, listas e situação são lidos uma vez por execução e servem a todos os lotes (como na Freitas, D-40). A
 * memória fica presa ao `SourceHttp` da execução e some com ele.
 */
const caches = new WeakMap<SourceHttp, RunCache>();

function cacheOf(http: SourceHttp): RunCache {
  const existing = caches.get(http);
  if (existing) return existing;
  const created: RunCache = { home: null, lists: new Map(), live: new Map() };
  caches.set(http, created);
  return created;
}

/**
 * Leilão do Detran-MG (leilao.detran.mg.gov.br): quarta fonte (docs/PLANO-COLETA.md §2.8, D-48). O próprio Detran
 * vende, sem leiloeiro; HTML do servidor, sem anti-robô. A descoberta lê os leilões abertos da página inicial e a lista
 * de cada um; o lote junta o cartão da lista (leilão, município, pátio), a página do lote (ficha e fotos, lida uma
 * vez) e a consulta interna de situação, que responde por 100 lotes de uma vez e mantém o valor final depois do fim.
 * Encerrado o leilão, a lista sai do ar e a página do lote perde fotos e anos: a revisita parte do dado guardado.
 */
export const detranMgSource: SourceAdapter = {
  id: "detran-mg",
  name: DETRAN_MG_NAME,
  baseUrl: DETRAN_MG_BASE_URL,
  // Lote novo custa a página (1 s); a situação vem em lotes de 100. ~500 cabem no tempo do job com a descoberta.
  maxVisitsPerRun: 500,
  usesStoredRaw: true,
  listingUrl: detranListingUrl,
  discover,
  async fetchListing(http, externalId, now, stored) {
    const id = parseDetranExternalId(externalId);
    if (!id) return { ok: false, gone: false, error: `id fora do formato leilão-lote (${externalId})` };
    const previous = readStored(stored, id.lotId);

    const home = await homeOf(http);
    if (!home.ok) return { ok: false, gone: false, error: home.error };
    const ref = home.value.get(id.auctionId);
    const list = ref ? await listOf(http, ref) : ({ ok: true, value: null } as const);
    if (!list.ok) return { ok: false, gone: false, error: list.error };

    const card = list.value?.cards.get(id.lotId) ?? previous?.card ?? null;
    const auction = list.value?.auction ??
      previous?.auction ?? { id: id.auctionId, number: null, city: null, yard: null };

    const live = await liveOf(http, id.lotId, list.value ? [...list.value.cards.keys()] : []);
    if (!live.ok) return { ok: false, gone: false, error: live.error };
    // O site não conhece o lote: não há o que ler.
    if (live.value === null) return { ok: false, gone: true, error: "lote ausente na consulta de situação" };

    // A ficha e as fotos não mudam; depois do fim o site as tira do ar. Lidas uma vez só.
    let page = previous?.page ?? null;
    if (page === null) {
      const response = await http.get(detranLotUrl(id.lotId));
      if (!response.ok) {
        return { ok: false, gone: response.status === 404 || response.status === 410, error: response.error };
      }
      page = parseDetranLotPage(response.text);
      if (page === null) return { ok: false, gone: true, error: "página do lote fora do ar" };
    }

    const snapshot = snapshotLive(live.value, previous?.live ?? null, now);
    const closesAt = detranClosesAt(ref?.closesAt, previous?.auction.closesAt, snapshot, now);
    const raw: DetranRaw = { lotId: id.lotId, auction: { ...auction, closesAt }, card, page, live: snapshot };
    return { ok: true, value: buildDetranListing(raw, now) };
  },
  detailsFromRaw: detranDetailsFromRaw,
};

async function discover(http: SourceHttp): Promise<Discovery> {
  const discovery: Discovery = { listings: [], complete: true, errors: [] };
  const home = await homeOf(http);
  if (!home.ok) {
    discovery.errors.push({ url: DETRAN_MG_BASE_URL, error: home.error });
    return { ...discovery, complete: false };
  }
  for (const ref of home.value.values()) {
    const list = await listOf(http, ref);
    if (!list.ok) {
      discovery.complete = false;
      discovery.errors.push({ url: detranAuctionUrl(ref, 1), error: list.error });
      continue;
    }
    // Fechou entre a página inicial e a lista: fica de fora; as revisitas dão o desfecho.
    if (list.value === null) continue;
    for (const lotId of list.value.cards.keys()) {
      discovery.listings.push({
        externalId: detranExternalId(ref.id, lotId),
        url: detranLotUrl(lotId),
        lastModified: null,
      });
    }
  }
  return discovery;
}

function homeOf(http: SourceHttp): Promise<Outcome<Map<string, DetranAuctionRef>>> {
  const cache = cacheOf(http);
  cache.home ??= (async () => {
    const response = await http.get(`${DETRAN_MG_BASE_URL}/`);
    if (!response.ok) return { ok: false, error: response.error };
    const refs = parseDetranHome(response.text);
    // Página inicial sem nenhum leilão: o site mudou ou falhou, nunca "nenhum leilão aberto" sem conferir.
    if (refs.length === 0 && !/lista-lotes|Sistema de Leil/i.test(response.text)) {
      return { ok: false, error: "página inicial sem a lista de leilões" };
    }
    return { ok: true, value: new Map(refs.map((ref) => [ref.id, ref])) };
  })();
  return cache.home;
}

function listOf(http: SourceHttp, ref: DetranAuctionRef): Promise<Outcome<AuctionList>> {
  const cache = cacheOf(http);
  let pending = cache.lists.get(ref.id);
  if (!pending) {
    pending = readList(http, ref);
    cache.lists.set(ref.id, pending);
  }
  return pending;
}

async function readList(http: SourceHttp, ref: DetranAuctionRef): Promise<Outcome<AuctionList>> {
  const cards = new Map<string, DetranCard>();
  let auction: DetranAuction | null = null;
  let lastPage = 1;
  for (let page = 1; page <= Math.min(lastPage, MAX_PAGES); page++) {
    const response = await http.get(detranAuctionUrl(ref, page));
    if (!response.ok) return { ok: false, error: response.error };
    const parsed = parseDetranAuctionPage(response.text, ref.id);
    // Sem cabeçalho de leilão: o site redirecionou ao início (leilão encerrado).
    if (parsed === null) return page === 1 ? { ok: true, value: null } : { ok: false, error: "lista interrompida" };
    auction ??= parsed.auction;
    lastPage = parsed.lastPage;
    for (const card of parsed.cards) cards.set(card.lotId, card);
  }
  if (lastPage > MAX_PAGES) return { ok: false, error: `lista com ${lastPage} páginas; lidas só ${MAX_PAGES}` };
  return auction === null ? { ok: true, value: null } : { ok: true, value: { auction, cards } };
}

/**
 * Situação do lote. Pede junto os vizinhos do mesmo leilão ainda sem situação nesta execução: o próximo lote
 * visitado já a encontra na memória. `null`: o site não conhece o lote.
 */
async function liveOf(
  http: SourceHttp,
  lotId: string,
  neighbors: readonly string[],
): Promise<Outcome<DetranLiveLot | null>> {
  const cache = cacheOf(http);
  const cached = cache.live.get(lotId);
  if (cached) return { ok: true, value: cached };
  const batch = [lotId, ...neighbors.filter((id) => id !== lotId && !cache.live.has(id))].slice(0, LIVE_BATCH);
  const response = await http.get(detranLiveUrl(batch));
  if (!response.ok) return { ok: false, error: response.error };
  const parsed = parseDetranLive(response.text);
  if (!parsed.ok) return { ok: false, error: `consulta de situação: ${parsed.error}` };
  for (const [id, lot] of parsed.value) cache.live.set(id, lot);
  return { ok: true, value: parsed.value.get(lotId) ?? null };
}

function readStored(stored: unknown, lotId: string): DetranRaw | null {
  const raw = readDetranRaw(stored);
  return raw?.lotId === lotId ? raw : null;
}
