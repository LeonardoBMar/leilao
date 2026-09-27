import type { SourceAdapter } from "../types";
import { parseLeiloSitemap } from "./discover";
import { leiloListingUrl, parseLeiloListingPage } from "./parse";

/** Leilo (leilo.com.br): primeira fonte (docs/PLANO-COLETA.md §2). */
export const leiloSource: SourceAdapter = {
  id: "leilo",
  sitemapUrls: ["https://leilo.com.br/sitemap-lotes.xml"],
  listingUrl: leiloListingUrl,
  parseSitemap: parseLeiloSitemap,
  parseListingPage: parseLeiloListingPage,
};
