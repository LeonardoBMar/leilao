import type { Route } from "next";

import { DEFAULT_RADIUS_KM } from "@/domain/listings/criteria";

import { type ListingFilters, listingParams, parseListingParams } from "./listing-filters";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export type CatalogAuctionKey = { sourceId: string; externalId: string };

/** Telas de "Leilões" (D-42). Os filtros dos anúncios valem nas três e passam de uma para outra. */
export const CATALOG_AUCTIONS_PATH = "/leiloes";
export const CATALOG_LISTINGS_PATH = "/leiloes/veiculos";

export function catalogAuctionPath({ sourceId, externalId }: CatalogAuctionKey): Route {
  return `/leiloes/${encodeURIComponent(sourceId)}/${encodeURIComponent(externalId)}` as Route;
}

/** Caminho com os filtros atuais (sem página). */
export function withQuery(path: string, params: Readonly<Record<string, string | undefined>>): Route {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return (query ? `${path}?${query}` : path) as Route;
}

/**
 * Filtros dos anúncios a partir da URL: `filters` para a consulta e `params` (forma canônica, sem padrões nem página)
 * para a barra de filtros, links e paginação.
 */
export function readListingSearch(
  raw: Record<string, string | string[] | undefined>,
  defaultRadiusKm: number = DEFAULT_RADIUS_KM,
): {
  filters: ListingFilters;
  params: Record<string, string>;
} {
  const filters = parseListingParams(raw, defaultRadiusKm);
  return { filters, params: listingParams(filters, defaultRadiusKm) };
}
