import "server-only";

import {
  catalogAuctionDate,
  type CatalogAuctionStats,
  selectCatalogAuctions,
} from "@/domain/listings/catalog-auctions";
import { getUserPreferences } from "@/features/preferences/queries";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { catalogSources } from "@/server/catalog-values";
import { db } from "@/server/db";

import { CATALOG_AUCTIONS_PAGE_SIZE, type ListingFilters } from "../schemas";
import type { CatalogAuctionDetail, CatalogAuctionKey, CatalogAuctionPage } from "../types";
import { auctionWhere, criteriaWhere, loadCriteriaValues, openWhere, screenWhere } from "./where";

export const keyOf = (sourceId: string, externalId: string) => JSON.stringify([sourceId, externalId]);

/** Contagem por leilão (chave `keyOf`); anúncio sem leilão fica de fora. */
export function countByAuction(
  pairs: readonly { sourceId: string; auctionExternalId: string | null; count?: number }[],
) {
  const counts = new Map<string, CatalogAuctionKey & { count: number }>();
  for (const { sourceId, auctionExternalId, count = 1 } of pairs) {
    if (auctionExternalId === null) continue;
    const key = keyOf(sourceId, auctionExternalId);
    const entry = counts.get(key) ?? { sourceId, externalId: auctionExternalId, count: 0 };
    counts.set(key, { ...entry, count: entry.count + count });
  }
  return counts;
}

type CatalogAuctionStatsRow = CatalogAuctionStats & { sourceName: string };

/** Números de cada leilão do catálogo. `matching` sai zerado: depende dos filtros da tela. */
export async function loadCatalogAuctionStats(
  ownerId: string,
  keys: readonly CatalogAuctionKey[],
  now: Date,
): Promise<CatalogAuctionStatsRow[]> {
  if (keys.length === 0) return [];
  const inKeys: Prisma.ListingWhereInput = { OR: keys.map(auctionWhere) };
  const [totals, opens, names, lots, sources] = await Promise.all([
    db.listing.groupBy({
      by: ["sourceId", "auctionExternalId"],
      where: inKeys,
      _count: { _all: true },
      _min: { auctionStartsAt: true, startsAt: true, endsAt: true },
    }),
    db.listing.groupBy({
      by: ["sourceId", "auctionExternalId"],
      where: { AND: [inKeys, openWhere(now)] },
      _count: { _all: true },
    }),
    // Nome do anúncio visto mais recentemente: o leilão pode mudar de nome entre coletas.
    db.listing.findMany({
      where: inKeys,
      distinct: ["sourceId", "auctionExternalId"],
      orderBy: [{ sourceId: "asc" }, { auctionExternalId: "asc" }, { lastSeenAt: "desc" }],
      select: { sourceId: true, auctionExternalId: true, auctionName: true },
    }),
    db.lot.findMany({
      where: { ownerId, listing: inKeys },
      select: { listing: { select: { sourceId: true, auctionExternalId: true } } },
    }),
    catalogSources(),
  ]);

  const openByKey = countByAuction(opens.map((group) => ({ ...group, count: group._count._all })));
  const countOf = (counts: ReturnType<typeof countByAuction>, key: string) => counts.get(key)?.count ?? 0;
  const analyzedByKey = countByAuction(lots.flatMap(({ listing }) => (listing ? [listing] : [])));
  const nameByKey = new Map(
    names.flatMap((row) =>
      row.auctionExternalId === null ? [] : [[keyOf(row.sourceId, row.auctionExternalId), row.auctionName] as const],
    ),
  );
  const sourceNames = new Map(sources.map((source) => [source.id, source.name]));

  return totals.flatMap((group) => {
    if (group.auctionExternalId === null) return [];
    const key = keyOf(group.sourceId, group.auctionExternalId);
    return [
      {
        sourceId: group.sourceId,
        sourceName: sourceNames.get(group.sourceId) ?? group.sourceId,
        externalId: group.auctionExternalId,
        name: nameByKey.get(key) ?? null,
        auctionStartsAt: group._min.auctionStartsAt,
        firstStartsAt: group._min.startsAt,
        firstEndsAt: group._min.endsAt,
        total: group._count._all,
        open: countOf(openByKey, key),
        matching: 0,
        analyzed: countOf(analyzedByKey, key),
      },
    ];
  });
}

/**
 * Leilões do catálogo de uma aba (D-42), com os números de cada um. Os filtros são os dos anúncios: o leilão aparece
 * se tem lote no filtro. Na aba de abertos, conta só lotes abertos; na de encerrados, todos.
 */
export async function listCatalogAuctions(filters: ListingFilters): Promise<CatalogAuctionPage> {
  const [user, { region }] = await Promise.all([requireUser(), getUserPreferences()]);
  const now = new Date();
  // Na aba de encerrados, o leilão entra com qualquer lote no filtro: a situação é do leilão (`selectCatalogAuctions`).
  const where: Prisma.ListingWhereInput = {
    AND: [
      { auctionExternalId: { not: null } },
      filters.ended ? {} : openWhere(now),
      criteriaWhere(filters.criteria, await loadCriteriaValues(filters.criteria, region)),
      screenWhere(filters, user.id, now),
    ],
  };

  const groups = await db.listing.groupBy({ by: ["sourceId", "auctionExternalId"], where, _count: { _all: true } });
  const matching = countByAuction(groups.map((group) => ({ ...group, count: group._count._all })));

  const stats = await loadCatalogAuctionStats(user.id, [...matching.values()], now);
  const selected = selectCatalogAuctions(
    stats.map((item) => ({ ...item, matching: matching.get(keyOf(item.sourceId, item.externalId))?.count ?? 0 })),
    filters.ended,
  );
  const start = (filters.page - 1) * CATALOG_AUCTIONS_PAGE_SIZE;

  return {
    items: selected.slice(start, start + CATALOG_AUCTIONS_PAGE_SIZE),
    total: selected.length,
    page: filters.page,
    pageSize: CATALOG_AUCTIONS_PAGE_SIZE,
  };
}

/** Um leilão do catálogo, para o cabeçalho da sua página; `null` se não há anúncio dele. */
export async function getCatalogAuction(key: CatalogAuctionKey): Promise<CatalogAuctionDetail | null> {
  const user = await requireUser();
  const [[stats], userAuction] = await Promise.all([
    loadCatalogAuctionStats(user.id, [key], new Date()),
    db.auction.findUnique({
      where: { ownerId_sourceId_externalId: { ownerId: user.id, ...key } },
      select: { id: true },
    }),
  ]);
  if (!stats) return null;
  return { ...stats, date: catalogAuctionDate(stats), isOpen: stats.open > 0, userAuctionId: userAuction?.id ?? null };
}
