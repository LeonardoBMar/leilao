import type { Discovery, SourceAdapter, SourceHttp } from "../types";
import {
  ASTAVERO_SITE_KEYS,
  astaveroListUrl,
  astaveroLotApiUrl,
  buildDetranScListing,
  DETRAN_SC_BASE_URL,
  DETRAN_SC_NAME,
  detranScDetailsFromRaw,
  detranScExternalId,
  detranScListingUrl,
  detranScLotUrl,
  parseAstaveroList,
  parseAstaveroLot,
  parseDetranScExternalId,
} from "./parse";

/**
 * Leilões do Detran-SC nos sites da plataforma Astavero (docs/PLANO-COLETA.md §2.10, D-57). O Detran-SC faz uns 17
 * leilões por ano, cada um com um leiloeiro do rodízio; quatro deles usam a Astavero (Maxter, Krobel, Deltta,
 * Damiani). A descoberta lê a lista de lotes abertos de cada site (uma requisição por site, todos os lotes de uma vez)
 * e fica com os do Detran; o lote vem da consulta interna do site, que depois do pregão mantém a situação e os
 * lances (o maior é o preço final). Lances trazem nome, CPF e IP de quem deu o lance: o adaptador lê só o valor.
 */
export const detranScSource: SourceAdapter = {
  id: "detran-sc",
  name: DETRAN_SC_NAME,
  baseUrl: DETRAN_SC_BASE_URL,
  listingUrl: detranScListingUrl,
  discover,
  async fetchListing(http, externalId, now) {
    const ref = parseDetranScExternalId(externalId);
    if (!ref) return { ok: false, gone: false, error: `id fora do formato site-leilão-lote (${externalId})` };
    const response = await http.post(astaveroLotApiUrl(ref.site), { id: ref.lotId });
    if (!response.ok)
      return { ok: false, gone: response.status === 404 || response.status === 410, error: response.error };
    const parsed = parseAstaveroLot(response.text, ref);
    if (!parsed.ok) return { ok: false, gone: false, error: parsed.error };
    if (parsed.value === null) return { ok: false, gone: true, error: "lote desconhecido pelo site" };
    return { ok: true, value: buildDetranScListing(parsed.value, now) };
  },
  detailsFromRaw: detranScDetailsFromRaw,
};

async function discover(http: SourceHttp): Promise<Discovery> {
  const discovery: Discovery = { listings: [], complete: true, errors: [] };
  for (const site of ASTAVERO_SITE_KEYS) {
    const url = astaveroListUrl(site);
    const response = await http.post(url, {});
    const parsed = response.ok ? parseAstaveroList(response.text, site) : null;
    if (parsed === null || !parsed.ok) {
      discovery.complete = false;
      discovery.errors.push({ url, error: response.ok ? `lista de lotes: ${parsed?.error}` : response.error });
      continue;
    }
    if (parsed.value.truncated) {
      discovery.complete = false;
      discovery.errors.push({ url, error: "lista de lotes cortada" });
    }
    for (const ref of parsed.value.lots) {
      discovery.listings.push({ externalId: detranScExternalId(ref), url: detranScLotUrl(ref), lastModified: null });
    }
  }
  return discovery;
}
