import "server-only";

import { cache } from "react";

import { DEFAULT_CATEGORIES, type ListingCriteria } from "@/domain/listings/criteria";
import { facetGroupsFromCombos, facetsFromGroups } from "@/domain/listings/facets";
import { distanceKm } from "@/domain/listings/geo";
import { collectorHealth, overallHealth } from "@/domain/listings/health";
import { DEFAULT_REGION } from "@/domain/listings/region";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { municipalitiesWithin } from "@/server/catalog-values";
import { db } from "@/server/db";

import { type ListingFilters, LISTINGS_PAGE_SIZE } from "../schemas";
import type { CatalogAuctionKey, CollectorStatus, ListingFacetsView, ListingPage } from "../types";
import { loadEstimateContext } from "./estimates";
import {
  categoriesWhere,
  criteriaWhere,
  fuelWhere,
  listingCardSelect,
  listingsOrderBy,
  listingsWhere,
  loadCriteriaValues,
  MAX_CANDIDATES,
  openWhere,
  originWhere,
  radiusWhere,
  searchWhere,
  toListItem,
} from "./where";

const byDistance = (a: { distanceKm: number | null }, b: { distanceKm: number | null }) =>
  (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);

/** Anúncios com os filtros da URL; com `auction`, só os daquele leilão do catálogo. */
export async function listListings(
  filters: ListingFilters,
  scope: { auction?: CatalogAuctionKey } = {},
): Promise<ListingPage> {
  const user = await requireUser();
  const select = listingCardSelect(user.id);
  const now = new Date();
  const where = listingsWhere(filters, await loadCriteriaValues(filters.criteria), user.id, now, scope.auction);
  const orderBy = listingsOrderBy(filters);
  const start = (filters.page - 1) * LISTINGS_PAGE_SIZE;

  // Fora a ordem por distância, tudo é filtrável e ordenável no banco: pagina lá.
  if (filters.sort !== "perto") {
    const [rows, total, context] = await Promise.all([
      db.listing.findMany({ where, orderBy, skip: start, take: LISTINGS_PAGE_SIZE, select }),
      db.listing.count({ where }),
      // Encerrados já têm lance final: sem estimativa, sem carregar a base.
      filters.ended ? Promise.resolve(null) : loadEstimateContext(now),
    ]);
    return {
      items: rows.map((row) => toListItem(row, context)),
      total,
      page: filters.page,
      pageSize: LISTINGS_PAGE_SIZE,
      truncated: false,
    };
  }

  // "Mais perto": ordena só id + coordenadas sobre no máximo MAX_CANDIDATES e busca os cartões só da página atual.
  const candidates = await db.listing.findMany({
    where,
    orderBy,
    take: MAX_CANDIDATES + 1,
    select: { id: true, municipality: { select: { latitude: true, longitude: true } } },
  });
  const truncated = candidates.length > MAX_CANDIDATES;
  // Ordenação estável: empates na distância mantêm a ordem do banco.
  const sorted = candidates
    .slice(0, MAX_CANDIDATES)
    .map((row) => ({
      id: row.id,
      distanceKm: row.municipality ? distanceKm(DEFAULT_REGION.center, row.municipality) : null,
    }))
    .sort(byDistance);
  const pageIds = sorted.slice(start, start + LISTINGS_PAGE_SIZE).map((item) => item.id);
  if (pageIds.length === 0) {
    return {
      items: [],
      total: sorted.length,
      page: filters.page,
      pageSize: LISTINGS_PAGE_SIZE,
      truncated,
    };
  }

  const [rows, context] = await Promise.all([
    db.listing.findMany({ where: { id: { in: pageIds } }, select }),
    filters.ended ? Promise.resolve(null) : loadEstimateContext(now),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items = pageIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toListItem(row, context)] : [];
  });

  return {
    items,
    total: sorted.length,
    page: filters.page,
    pageSize: LISTINGS_PAGE_SIZE,
    truncated,
  };
}

/** Grupos de marca e modelo lidos para as sugestões da busca: os mais frequentes bastam. */
const MAX_SUGGESTION_GROUPS = 3_000;

/**
 * Contagens dos chips (categoria, fonte, origem, combustível) e sugestões da busca (docs/PLANO-FILTROS.md §4), no
 * banco (D-82): as combinações dos quatro chips numa consulta, com a busca e os filtros da tela aplicados, e as marcas e
 * modelos das sugestões noutra, com os chips e sem a busca. Cada faceta conta sem o próprio chip
 * (`facetGroupsFromCombos`).
 */
export async function getListingFacets(
  filters: ListingFilters,
  scope: { auction?: CatalogAuctionKey } = {},
): Promise<ListingFacetsView> {
  const user = await requireUser();
  const now = new Date();
  const { criteria } = filters;
  const values = await loadCriteriaValues(criteria);
  const withoutFacets: ListingFilters = {
    ...filters,
    criteria: { ...criteria, search: null, categories: null, sources: [], origins: [], fuels: [] },
  };
  const base = listingsWhere(withoutFacets, values, user.id, now, scope.auction);
  const chips: Prisma.ListingWhereInput = {
    AND: [
      categoriesWhere(criteria.categories),
      criteria.sources.length === 0 ? {} : { sourceId: { in: [...criteria.sources] } },
      originWhere(criteria.origins),
      fuelWhere(criteria.fuels, values),
    ],
  };

  const [combos, vehicles, activeSources] = await Promise.all([
    db.listing.groupBy({
      by: ["category", "sourceId", "vehicleOrigin", "fuel"],
      where: { AND: [base, searchWhere(criteria.search)] },
      _count: { _all: true },
    }),
    db.listing.groupBy({
      by: ["brand", "model"],
      where: { AND: [base, chips, { brand: { not: null } }] },
      _count: { _all: true },
      orderBy: { _count: { brand: "desc" } },
      take: MAX_SUGGESTION_GROUPS,
    }),
    db.source.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const facets = facetsFromGroups({
    ...facetGroupsFromCombos(
      combos.map(({ category, sourceId, vehicleOrigin, fuel, _count }) => ({
        category,
        sourceId,
        origin: vehicleOrigin,
        fuel,
        count: _count._all,
      })),
      criteria,
    ),
    vehicles: vehicles.map(({ brand, model, _count }) => ({ brand, model, count: _count._all })),
  });

  return {
    ...facets,
    sources: activeSources.map((source) => ({ ...source, count: facets.sources[source.id] ?? 0 })),
  };
}

/** Fontes ativas, para escolher nos filtros e nos monitores. */
export async function listActiveSources(): Promise<{ id: string; name: string }[]> {
  await requireUser();
  return db.source.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** Quantos anúncios abertos atendem aos critérios agora (ex.: "12 lotes combinam com este monitor"). */
export async function countOpenListings(criteria: ListingCriteria): Promise<number> {
  await requireUser();
  const where: Prisma.ListingWhereInput = {
    AND: [openWhere(new Date()), criteriaWhere(criteria, await loadCriteriaValues(criteria))],
  };
  return db.listing.count({ where });
}

/** Saúde do coletor para o dashboard e para "Leilões": última execução de cada fonte e abertos na região. */
export const getCollectorStatus = cache(async (): Promise<CollectorStatus> => {
  await requireUser();
  const now = new Date();

  const [sources, openInRegion] = await Promise.all([
    // Última execução de cada fonte ativa (D-37): uma fonte parada não fica escondida atrás das outras.
    db.source.findMany({
      where: { active: true },
      select: {
        name: true,
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { status: true, startedAt: true, finishedAt: true, failed: true },
        },
      },
    }),
    municipalitiesWithin(DEFAULT_REGION.radiusKm).then((nearby) =>
      db.listing.count({ where: { AND: [openWhere(now), radiusWhere(nearby), categoriesWhere(DEFAULT_CATEGORIES)] } }),
    ),
  ]);
  const runs = sources.flatMap(({ name, runs: [run] }) =>
    run ? [{ ...run, name, health: collectorHealth(run, now) }] : [],
  );
  const finished = runs.flatMap((run) => (run.finishedAt ? [run.finishedAt.getTime()] : []));

  return {
    health: overallHealth(runs.map((run) => run.health)),
    lastFinishedAt: finished.length > 0 ? new Date(Math.max(...finished)) : null,
    failingSources: runs.filter((run) => run.health === "failed").map((run) => run.name),
    failedListings: runs.reduce((total, run) => total + run.failed, 0),
    openInRegion,
    regionLabel: DEFAULT_REGION.label,
    radiusKm: DEFAULT_REGION.radiusKm,
  };
});
