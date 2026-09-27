import type { DiscoveredListing } from "../types";

const LOT_URL = /\/lote\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

/**
 * Lê o `sitemap-lotes.xml` do Leilo: os lotes abertos, com a data da última alteração.
 * Entradas que não são página de lote são ignoradas; o mesmo lote repetido aparece uma vez.
 */
export function parseLeiloSitemap(xml: string): DiscoveredListing[] {
  const found = new Map<string, DiscoveredListing>();
  for (const [entry] of xml.matchAll(/<url>[\s\S]*?<\/url>/g)) {
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/.exec(entry)?.[1];
    const externalId = loc ? LOT_URL.exec(loc)?.[1]?.toLowerCase() : undefined;
    if (!loc || !externalId || found.has(externalId)) continue;
    const lastmod = /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/.exec(entry)?.[1];
    const lastModified = lastmod ? new Date(lastmod) : null;
    found.set(externalId, {
      externalId,
      url: loc,
      lastModified: lastModified && !Number.isNaN(lastModified.getTime()) ? lastModified : null,
    });
  }
  return [...found.values()];
}
