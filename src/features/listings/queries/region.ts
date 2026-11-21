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
import { keyOf } from "./auctions";
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

const earlierDate = (a: Date | null, b: Date | null): Date | null => {
  if (a === null) return b;
  if (b === null) return a;
  return a.getTime() <= b.getTime() ? a : b;
};

/** Campos de um candidato da home (D-82, D-85): filtro exato, estimativa, lote do usuário e metadados do leilão. */
const regionCandidateSelect = (ownerId: string) =>
  ({
    ...listingForDefaultsSelect,
    id: true,
    sourceId: true,
    source: { select: { name: true } },
    auctionExternalId: true,
    auctionName: true,
    auctionStartsAt: true,
    startsAt: true,
    lastSeenAt: true,
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
  const [watches, dismissals, context] = await Promise.all([
    db.watch.findMany({ where: { ownerId: user.id, active: true }, select: storedCriteriaSelect }),
    // Dispensados (D-56) saem só das sugestões; buscar todos do usuário em paralelo evita 1 RTT e `IN` gigante (D-85).
    db.listingDismissal.findMany({ where: { ownerId: user.id }, select: { listingId: true } }),
    getEstimateContext(),
  ]);
  const dismissed = new Set(dismissals.map(({ listingId }) => listingId));
  const criteriaList = [DEFAULT_CRITERIA, ...watches.map(criteriaFromStored)];
  const wheres = await Promise.all(
    criteriaList.map(async (criteria) => criteriaWhere(criteria, await loadCriteriaValues(criteria))),
  );

  // Fase 1 (D-82, D-85): só o que o filtro exato, a estimativa e o resumo de leilões leem, sem fotos nem textos longos.
  const rows = await db.listing.findMany({
    // O banco filtra por cada critério; `matchesCriteria` confere a regra exata (a busca compara o texto normalizado).
    where: { AND: [openWhere(now), { auctionExternalId: { not: null } }, { OR: wheres }] },
    orderBy: [{ endsAt: "asc" }, { id: "asc" }],
    take: MAX_CANDIDATES + 1,
    select: regionCandidateSelect(user.id),
  });
  const truncated = rows.length > MAX_CANDIDATES;
  const nowMs = now.getTime();

  // Filtra por `matchesCriteria` antes de estimar e só calcula estimativa para quem entra em sugestões ou nos 7 dias.
  const matching = rows.slice(0, MAX_CANDIDATES).flatMap((row) => {
    const distance = row.municipality ? distanceKm(DEFAULT_REGION.center, row.municipality) : null;
    if (!criteriaList.some((criteria) => matchesCriteria(criteria, toMatchable(row, distance), now))) return [];
    const isSoon = row.endsAt !== null && row.endsAt.getTime() - nowMs <= REGION_AUCTIONS_WINDOW_MS;
    const isCandidate = row.lots.length === 0 && !dismissed.has(row.id);
    const estimate = isCandidate || isSoon ? estimateFor(row, context) : null;
    return [{ row, isSoon, isCandidate, estimate }];
  });

  const toAnalyzeCandidates = matching
    .flatMap((candidate) =>
      candidate.isCandidate && candidate.estimate && fitsEstimate(candidate)
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

  // Leilões dos próximos 7 dias agregados diretamente dos candidatos abertos (elimina 5 queries em cascata, D-85).
  type AuctionBucket = {
    sourceId: string;
    sourceName: string;
    externalId: string;
    name: string | null;
    latestSeenMs: number;
    auctionStartsAt: Date | null;
    firstStartsAt: Date | null;
    firstEndsAt: Date | null;
    matching: number;
    fitting: number;
  };
  const buckets = new Map<string, AuctionBucket>();
  for (const item of matching) {
    if (!item.isSoon || item.row.auctionExternalId === null) continue;
    const { row } = item;
    const key = keyOf(row.sourceId, row.auctionExternalId);
    const seenMs = row.lastSeenAt.getTime();
    const fitCount = fitsEstimate(item) ? 1 : 0;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        sourceId: row.sourceId,
        sourceName: row.source.name,
        externalId: row.auctionExternalId,
        name: row.auctionName,
        latestSeenMs: seenMs,
        auctionStartsAt: row.auctionStartsAt,
        firstStartsAt: row.startsAt,
        firstEndsAt: row.endsAt,
        matching: 1,
        fitting: fitCount,
      });
    } else {
      existing.matching += 1;
      existing.fitting += fitCount;
      existing.auctionStartsAt = earlierDate(existing.auctionStartsAt, row.auctionStartsAt);
      existing.firstStartsAt = earlierDate(existing.firstStartsAt, row.startsAt);
      existing.firstEndsAt = earlierDate(existing.firstEndsAt, row.endsAt);
      if (seenMs > existing.latestSeenMs) {
        existing.latestSeenMs = seenMs;
        existing.name = row.auctionName;
      }
    }
  }

  const auctions = selectCatalogAuctions(
    [...buckets.values()].map(({ latestSeenMs: _seen, ...bucket }) => ({
      ...bucket,
      total: bucket.matching,
      open: bucket.matching,
      analyzed: 0,
    })),
    false,
  ).slice(0, REGION_AUCTIONS_SHOWN);

  return {
    toAnalyze,
    toAnalyzeTotal: toAnalyzeIds.length,
    toAnalyzeComfortable,
    auctions,
    auctionsTotal: buckets.size,
    truncated,
  };
});
