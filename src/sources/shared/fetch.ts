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
    if (!/<(urlset|sitemapindex)\b/i.test(response.text)) {
      discovery.complete = false;
      discovery.errors.push({ url, error: "sitemap fora do formato" });
      continue;
    }
    discovery.listings.push(...parse(response.text));
  }
  if (discovery.complete && discovery.listings.length === 0) {
    discovery.complete = false;
    discovery.errors.push({ url: urls[0] ?? "(sitemap)", error: "nenhum lote encontrado no sitemap" });
  }
  return discovery;
}

/**
 * Anúncio que é uma página só: baixa e lê. HTTP 404 ou 410 é "fora do ar" (`gone`). Página de **outro** anúncio também:
 * o Leilo republica o veículo não vendido num leilão novo, com outro id, e a URL antiga redireciona (301) para ele;
 * o anúncio pedido não existe mais e o novo entra pela descoberta.
 */
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
  if (!parsed.ok) return { ok: false, gone: false, error: parsed.error };
  if (parsed.value.url !== url)
    return { ok: false, gone: true, error: `redireciona para outro anúncio (${parsed.value.externalId})` };
  return parsed;
}
