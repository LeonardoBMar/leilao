import { discoverFromSitemaps, fetchListingPage } from "../shared/fetch";
import type { SourceAdapter } from "../types";
import { parseLeiloSitemap } from "./discover";
import { leiloDetailsFromRaw, leiloListingUrl, parseLeiloListingPage } from "./parse";

const SITEMAP_URLS = ["https://leilo.com.br/sitemap-lotes.xml"];

/** Leilo (leilo.com.br): primeira fonte (docs/PLANO-COLETA.md §2). Sitemap + uma página por lote. */
export const leiloSource: SourceAdapter = {
  id: "leilo",
  name: "Leilo",
  baseUrl: "https://leilo.com.br",
  listingUrl: leiloListingUrl,
  discover: (http) => discoverFromSitemaps(http, SITEMAP_URLS, parseLeiloSitemap),
  fetchListing: (http, externalId, now) =>
    fetchListingPage(http, leiloListingUrl(externalId), parseLeiloListingPage, now),
  detailsFromRaw: leiloDetailsFromRaw,
};
