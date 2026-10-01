import type { DiscoveredListing, Discovery, ListingFetch, PageParser, SourceHttp } from "../types";

/** Descoberta pelos sitemaps da fonte: completa só se todos carregarem. */
export async function discoverFromSitemaps(
  http: SourceHttp,
  urls: readonly string[],
  parse: (xml: string) => DiscoveredListing[],
): Promise<Discovery> {
  const discovery: Discovery = { listings: [], complete: true, errors: [] };
  for (const url of urls) {
    const response = await http.get(url);
    if (!response.ok) {
      discovery.complete = false;
      discovery.errors.push({ url, error: response.error });
      continue;
    }
    discovery.listings.push(...parse(response.text));
  }
  return discovery;
}

/** Anúncio que é uma página só: baixa e lê. HTTP 404 ou 410 é "fora do ar" (`gone`). */
export async function fetchListingPage(
  http: SourceHttp,
  url: string,
  parse: PageParser,
  now: Date,
): Promise<ListingFetch> {
  const response = await http.get(url);
  if (!response.ok)
    return { ok: false, gone: response.status === 404 || response.status === 410, error: response.error };
  const parsed = parse(response.text, now);
  return parsed.ok ? parsed : { ok: false, gone: false, error: parsed.error };
}
