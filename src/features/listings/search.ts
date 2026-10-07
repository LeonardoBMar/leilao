import type { Route } from "next";

import { DEFAULT_CATEGORY, DEFAULT_CONDITION } from "@/domain/listings/criteria";

import type { ListingFilterValues } from "./components/listing-filters";
import { DEFAULT_DISTANCE, type ListingFilters, listingFiltersSchema } from "./schemas";
import type { CatalogAuctionKey } from "./types";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Telas de "Leilões" (D-42). Os filtros dos anúncios valem nas três e passam de uma para outra. */
export const CATALOG_AUCTIONS_PATH = "/leiloes";
export const CATALOG_LISTINGS_PATH = "/leiloes/veiculos";

export function catalogAuctionPath({ sourceId, externalId }: CatalogAuctionKey): Route {
  return `/leiloes/${encodeURIComponent(sourceId)}/${encodeURIComponent(externalId)}` as Route;
}

/** Caminho com os filtros atuais (sem página). */
export function withQuery(path: string, params: Record<string, string | undefined>): Route {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return (query ? `${path}?${query}` : path) as Route;
}

/**
 * Filtros dos anúncios a partir da URL: `filters` para a consulta, `values` para o formulário e `params` para links
 * e paginação (padrões fora da URL).
 */
export function readListingSearch(raw: Record<string, string | string[] | undefined>): {
  filters: ListingFilters;
  values: ListingFilterValues;
  params: Record<string, string | undefined>;
} {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const filters = listingFiltersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, first(value)])),
  );
  const values: ListingFilterValues = {
    busca: filters.search,
    anoDe: filters.yearFrom?.toString(),
    anoAte: filters.yearTo?.toString(),
    precoAte: filters.maxPrice === undefined ? undefined : String(filters.maxPrice / 100),
    distancia: filters.distanceKm === null ? "todas" : String(filters.distanceKm),
    categoria: filters.category,
    condicao: filters.condition,
    situacao: filters.ended ? "encerrados" : "abertos",
  };
  const params: Record<string, string | undefined> = {
    busca: values.busca,
    anoDe: values.anoDe,
    anoAte: values.anoAte,
    precoAte: values.precoAte,
    distancia: values.distancia === DEFAULT_DISTANCE ? undefined : values.distancia,
    categoria: values.categoria === DEFAULT_CATEGORY ? undefined : values.categoria,
    condicao: values.condicao === DEFAULT_CONDITION ? undefined : values.condicao,
    situacao: values.situacao === "abertos" ? undefined : values.situacao,
  };
  return { filters, values, params };
}
