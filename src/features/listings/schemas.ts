import { z } from "zod";

export {
  DEFAULT_DISTANCE,
  DISTANCE_OPTIONS,
  ENDS_WITHIN_HOURS,
  ENDS_WITHIN_KEYS,
  type EndsWithin,
  type ListingFilters,
  listingFiltersSchema,
  listingParams,
  NEW_WINDOW_MS,
  parseListingParams,
  SORT_KEYS,
  type SortKey,
} from "@/lib/listing-filters";

export const LISTINGS_PAGE_SIZE = 24;
export const CATALOG_AUCTIONS_PAGE_SIZE = 24;

/** Segmentos de `/leiloes/[source]/[auction]` (D-42). Inválido: a página responde 404. */
export const catalogAuctionParamsSchema = z
  .object({
    source: z.string().regex(/^[a-z0-9-]{1,40}$/),
    auction: z.string().regex(/^[A-Za-z0-9._-]{1,200}$/),
  })
  .transform(({ source, auction }) => ({ sourceId: source, externalId: auction }));
