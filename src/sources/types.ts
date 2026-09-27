import type { ListingInput } from "@/domain/listings/types";
import type { Result } from "@/lib/result";

/** Anúncio encontrado na descoberta (sitemap), antes de baixar a página. */
export type DiscoveredListing = { externalId: string; url: string; lastModified: Date | null };

/** Página sem os dados esperados (a fonte mudou o formato) ou com dados inválidos. */
export type ParseError = "missing_data" | "invalid_data";

/**
 * Contrato de um adaptador de fonte (D-27). Tudo aqui é puro: o coletor baixa o texto e entrega ao adaptador.
 * Uma fonte nova é um adaptador novo; o coletor não muda.
 */
export type SourceAdapter = {
  /** Igual a `sources.id` no banco. */
  id: string;
  /** Sitemaps que listam os anúncios abertos. */
  sitemapUrls: readonly string[];
  /** URL canônica do anúncio, para revisitar depois que ele sai do sitemap. */
  listingUrl: (externalId: string) => string;
  parseSitemap: (xml: string) => DiscoveredListing[];
  /** `now` decide se um anúncio com situação desconhecida já deveria ter encerrado. */
  parseListingPage: (html: string, now: Date) => Result<ListingInput, ParseError>;
};
