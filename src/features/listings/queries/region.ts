import "server-only";

import { cache } from "react";

import { selectCatalogAuctions } from "@/domain/listings/catalog-auctions";
import {
  criteriaFromStored,
  DEFAULT_CRITERIA,
  type MatchableListing,
  matchesCriteria,
} from "@/domain/listings/criteria";
import { byAnalysisPriority } from "@/domain/listings/estimates";
import { distanceKm } from "@/domain/listings/geo";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { listingForDefaultsSelect } from "@/features/analyses/draft-defaults";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { storedCriteriaSelect } from "@/server/collector/alerts";
import { db } from "@/server/db";

import type { ListingEstimate, RegionOverview } from "../types";
import { countByAuction, keyOf, loadCatalogAuctionStats } from "./auctions";
import { getEstimateContext } from "./estimates";
import {
  criteriaWhere,
  estimateFor,
  listingCardSelect,
  loadCriteriaValues,
  MAX_CANDIDATES,
  openWhere,
  toCents,
  toListItem,
} from "./where";

/** Cartões em "Para analisar agora" (os 4 melhores da fila) e leilões em "Próximos leilões na região" (D-44). */
const TO_ANALYZE_SHOWN = 4;
const REGION_AUCTIONS_SHOWN = 5;
const REGION_AUCTIONS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const fitsEstimate = ({ estimate }: { estimate: ListingEstimate | null }) =>
  estimate?.fit === "comfortable" || estimate?.fit === "tight";

/** Campos de um candidato da home (D-82): o que `matchesCriteria` e a estimativa leem, mais o lote do usuário. */
const regionCandidateSelect = (ownerId: string) =>
  ({
    ...listingForDefaultsSelect,
    id: true,
    sourceId: true,
    auctionExternalId: true,
    title: true,
    brand: true,
    model: true,
    fipeName: true,
    fipeCode: true,
    marketValueFipeCode: true,
    modelYear: true,
    mileageKm: true,
    fuel: true,
    vehicleOrigin: true,
    hasKey: true,
    inspectionResult: true,
    status: true,
    endsAt: true,
    currentBidCents: true,
    minimumBidCents: true,
    lots: { where: { ownerId }, select: { id: true }, take: 1 },
  }) satisfies Prisma.ListingSelect;

type RegionCandidateRow = Prisma.ListingGetPayload<{ select: ReturnType<typeof regionCandidateSelect> }>;

function toMatchable(row: RegionCandidateRow, distance: number | null): MatchableListing {
  return {
    sourceId: row.sourceId,
    title: row.title,
    brand: row.brand,
    model: row.model,
    fipeName: row.fipeName,
    modelYear: row.modelYear,
    mileageKm: row.mileageKm,
    category: row.category,
    fuel: row.fuel,
    origin: row.vehicleOrigin,
    hasKey: row.hasKey,
    damageLevel: row.damageLevel,
    conditionFlags: row.conditionFlags,
    inspection: row.inspectionResult,
    status: row.status,
    endsAt: row.endsAt,
    currentBid: toCents(row.currentBidCents),
    minimumBid: toCents(row.minimumBidCents),
    marketValue: toCents(row.marketValueCents),
    distanceKm: distance,
  };
}

/**
 * O catálogo visto da home (D-44): anúncios abertos no filtro padrão (`DEFAULT_CRITERIA`) ou em algum monitor ligado
 * do usuário. Daí saem "Para analisar agora" (ainda sem lote do usuário, com o provável cabendo no limite, na ordem de
 * `byAnalysisPriority`) e os leilões dos próximos 7 dias, com lotes no filtro e quantos cabem. Memo por requisição:
 * o cabeçalho e os dois blocos do dashboard leem o mesmo resultado.
 */
export const getRegionOverview = cache(async (): Promise<RegionOverview> => {
  const user = await requireUser();
  const now = new Date();
  const [watches, context] = await Promise.all([
    db.watch.findMany({ where: { ownerId: user.id, active: true }, select: storedCriteriaSelect }),
    getEstimateContext(),
  ]);
  const criteriaList = [DEFAULT_CRITERIA, ...watches.map(criteriaFromStored)];
  const wheres = await Promise.all(
    criteriaList.map(async (criteria) => criteriaWhere(criteria, await loadCriteriaValues(criteria))),
  );

  // Fase 1 (D-82): só o que o filtro exato e a estimativa leem, sem fotos e textos do cartão. Até 2 mil linhas por
  // tela; o cartão completo vem depois, só para os exibidos.
  const rows = await db.listing.findMany({
    // O banco filtra por cada critério; `matchesCriteria` confere a regra exata (a busca compara o texto normalizado).
    where: { AND: [openWhere(now), { auctionExternalId: { not: null } }, { OR: wheres }] },
    orderBy: [{ endsAt: "asc" }, { id: "asc" }],
    take: MAX_CANDIDATES + 1,
    select: regionCandidateSelect(user.id),
  });
  const truncated = rows.length > MAX_CANDIDATES;
  const matching = rows
    .slice(0, MAX_CANDIDATES)
    .map((row) => {
      const distance = row.municipality ? distanceKm(DEFAULT_REGION.center, row.municipality) : null;
      return { row, distance, estimate: estimateFor(row, context) };
    })
    .filter(({ row, distance }) => {
      const listing = toMatchable(row, distance);
      return criteriaList.some((criteria) => matchesCriteria(criteria, listing, now));
    });

  // Dispensados (D-56) saem só das sugestões; continuam contando nos leilões e no catálogo.
  const dismissed = new Set(
    (
      await db.listingDismissal.findMany({
        where: { ownerId: user.id, listingId: { in: matching.map(({ row }) => row.id) } },
        select: { listingId: true },
      })
    ).map(({ listingId }) => listingId),
  );
  const toAnalyzeCandidates = matching
    .flatMap((candidate) =>
      candidate.row.lots.length === 0 &&
      !dismissed.has(candidate.row.id) &&
      candidate.estimate &&
      fitsEstimate(candidate)
        ? [{ id: candidate.row.id, candidate: { ...candidate.estimate, endsAt: candidate.row.endsAt } }]
        : [],
    )
    .sort((a, b) => byAnalysisPriority(a.candidate, b.candidate));
  const toAnalyzeIds = toAnalyzeCandidates.map(({ id }) => id);
  const toAnalyzeComfortable = toAnalyzeCandidates.filter(({ candidate }) => candidate.fit === "comfortable").length;

  // Fase 2: o cartão completo só dos exibidos, na ordem da prioridade.
  const shownIds = toAnalyzeIds.slice(0, TO_ANALYZE_SHOWN);
  const cards =
    shownIds.length === 0
      ? []
      : await db.listing.findMany({ where: { id: { in: shownIds } }, select: listingCardSelect(user.id) });
  const cardById = new Map(cards.map((row) => [row.id, row]));
  const toAnalyze = shownIds.flatMap((id) => {
    const row = cardById.get(id);
    return row ? [toListItem(row, context)] : [];
  });

  // Leilões: só anúncios que encerram nos próximos 7 dias.
  const soon = matching.filter(
    ({ row }) => row.endsAt !== null && row.endsAt.getTime() - now.getTime() <= REGION_AUCTIONS_WINDOW_MS,
  );
  const inFilter = countByAuction(soon.map(({ row }) => row));
  const fitting = countByAuction(soon.filter(fitsEstimate).map(({ row }) => row));
  const stats = await loadCatalogAuctionStats(user.id, [...inFilter.values()], now);
  const auctions = selectCatalogAuctions(
    stats.map((item) => ({ ...item, matching: inFilter.get(keyOf(item.sourceId, item.externalId))?.count ?? 0 })),
    false,
  )
    .slice(0, REGION_AUCTIONS_SHOWN)
    .map((item) => ({ ...item, fitting: fitting.get(keyOf(item.sourceId, item.externalId))?.count ?? 0 }));

  return {
    toAnalyze,
    toAnalyzeTotal: toAnalyzeIds.length,
    toAnalyzeComfortable,
    auctions,
    auctionsTotal: inFilter.size,
    truncated,
  };
});
