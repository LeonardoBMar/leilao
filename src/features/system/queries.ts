import "server-only";

import { type FipeVehicleType, NON_FIPE_REASONS, pickFipeTable } from "@/domain/listings/fipe-match";
import { collectorHealth } from "@/domain/listings/health";
import { requireAdmin } from "@/server/auth";
import { db } from "@/server/db";
import { createFipeCatalog, loadFipeModelCandidates } from "@/server/fipe/catalog";
import { fipePendingListingWhere, getFipeMatch, listFipeMatches, notFromSource } from "@/server/fipe/matches";

import { collectorRunErrorsSchema, type FipeQueueFilters } from "./schemas";
import type {
  SystemCollectorOverview,
  SystemCollectorRun,
  SystemFipeMatchEditor,
  SystemFipeMatchItem,
  SystemFipeSummary,
  SystemSourceOverview,
} from "./types";

const RECENT_RUNS_PER_SOURCE = 5;
const FIPE_QUEUE_LIMIT = 50;

/**
 * Saúde e histórico recente de todas as fontes de coleta (D-88).
 * Lê tabelas globais (`sources`, `collector_runs`, `listings`), exigindo sessão autenticada.
 */
export async function getSystemCollectorOverview(): Promise<SystemCollectorOverview> {
  await requireAdmin();
  const now = new Date();

  const [sourceRows, openGroups] = await Promise.all([
    db.source.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        baseUrl: true,
        active: true,
        runs: {
          orderBy: { startedAt: "desc" },
          take: RECENT_RUNS_PER_SOURCE,
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            requests: true,
            discovered: true,
            created: true,
            updated: true,
            failed: true,
            alertsCreated: true,
            errors: true,
          },
        },
      },
    }),
    db.listing.groupBy({
      by: ["sourceId"],
      where: { status: "open" },
      _count: { _all: true },
    }),
  ]);

  const openBySource = new Map(openGroups.map((group) => [group.sourceId, group._count._all]));

  const sources: SystemSourceOverview[] = sourceRows.map((source) => {
    const runs: SystemCollectorRun[] = source.runs.map((run) => ({
      id: run.id,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      durationSec:
        run.finishedAt === null
          ? null
          : Math.max(0, Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000)),
      requests: run.requests,
      discovered: run.discovered,
      created: run.created,
      updated: run.updated,
      failed: run.failed,
      alertsCreated: run.alertsCreated,
      errors: collectorRunErrorsSchema.parse(run.errors),
    }));
    const latest = runs[0] ?? null;
    const health = collectorHealth(latest, now);
    return {
      id: source.id,
      name: source.name,
      baseUrl: source.baseUrl,
      active: source.active,
      health,
      openListings: openBySource.get(source.id) ?? 0,
      runs,
    };
  });

  const activeSources = sources.filter((source) => source.active);

  return {
    sources,
    activeCount: activeSources.length,
    pausedCount: sources.length - activeSources.length,
    failingCount: activeSources.filter((source) => source.health === "failed").length,
    lateCount: activeSources.filter((source) => source.health === "late").length,
    totalOpenListings: sources.reduce((total, source) => total + source.openListings, 0),
  };
}

/** Resumo e fila de correlações FIPE ordenadas por impacto em anúncios sem valor da fonte (D-88). */
export async function listSystemFipeQueue(
  filters: FipeQueueFilters,
): Promise<{ summary: SystemFipeSummary; items: SystemFipeMatchItem[] }> {
  await requireAdmin();
  const catalog = createFipeCatalog();
  const nonFipeList = [...NON_FIPE_REASONS];
  const activeFilter = { listings: { some: notFromSource } };

  const [reviewableCount, outOfFipeCount, matchedCount, manualCount, pendingListings, tables, items] =
    await Promise.all([
      db.fipeMatch.count({
        where: {
          kind: "none",
          ...activeFilter,
          OR: [{ reason: null }, { reason: { notIn: nonFipeList } }],
        },
      }),
      db.fipeMatch.count({
        where: {
          kind: "none",
          ...activeFilter,
          reason: { in: nonFipeList },
        },
      }),
      db.fipeMatch.count({
        where: {
          kind: { in: ["version", "family"] },
          ...activeFilter,
        },
      }),
      db.fipeMatch.count({ where: { origin: "manual", ...activeFilter } }),
      db.listing.count({ where: fipePendingListingWhere }),
      catalog.tables(),
      listFipeMatches({
        ...(filters.situacao === "revisao"
          ? { unmatchedScope: "reviewable" as const }
          : filters.situacao === "fora-fipe"
            ? { unmatchedScope: "out_of_fipe" as const }
            : filters.situacao === "todos"
              ? {}
              : { kind: filters.situacao }),
        ...(filters.origem === "todas" ? {} : { origin: filters.origem }),
        ...(filters.busca ? { search: filters.busca } : {}),
        onlyActive: true,
        limit: FIPE_QUEUE_LIMIT,
      }),
    ]);

  return {
    summary: {
      reviewable: reviewableCount,
      outOfFipe: outOfFipeCount,
      matched: matchedCount,
      manual: manualCount,
      pendingListings,
      latestTableMonth: tables[0]?.month ?? null,
    },
    items,
  };
}

/** Carrega uma correlação FIPE e as marcas/versões candidatas da tabela FIPE mais recente para edição manual. */
export async function getSystemFipeMatchEditor(
  id: string,
  override?: { vehicleType?: FipeVehicleType; brandCode?: string },
): Promise<SystemFipeMatchEditor | null> {
  await requireAdmin();
  const match = await getFipeMatch(id);
  if (!match) return null;

  const catalog = createFipeCatalog();
  const tables = await catalog.tables();
  const table = pickFipeTable(new Date(), tables);
  const selectedType = override?.vehicleType ?? match.vehicleType ?? 1;
  const brands = table ? await catalog.brands(table, selectedType) : [];
  const rawBrand =
    override?.brandCode ??
    (override?.vehicleType && override.vehicleType !== match.vehicleType ? null : match.brandCode);
  const selectedBrand = rawBrand && brands.some((brand) => brand.code === rawBrand) ? rawBrand : null;

  const candidates =
    table && selectedBrand
      ? await loadFipeModelCandidates(catalog, table, selectedType, selectedBrand, match.modelYear, match.fuel)
      : [];

  return {
    match,
    tableMonth: table?.month ?? null,
    selectedType,
    selectedBrand,
    brands,
    candidates,
  };
}
