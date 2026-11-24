import "server-only";

import { type AlertWatch, alertWindowStart, planAlerts } from "@/domain/listings/alerts";
import { criteriaFromStored } from "@/domain/listings/criteria";
import { type Coordinates, distanceKm } from "@/domain/listings/geo";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { cents } from "@/domain/money";

import { db } from "../db";

const toCents = (value: number | null) => (value === null ? null : cents(value));

/** Critérios gravados no monitor (mesmos campos de `StoredCriteria`). */
export const storedCriteriaSelect = {
  search: true,
  yearFrom: true,
  yearTo: true,
  minPriceCents: true,
  maxPriceCents: true,
  maxMarketPct: true,
  maxMileageKm: true,
  radiusKm: true,
  categories: true,
  condition: true,
  hide: true,
  sources: true,
  origins: true,
  fuels: true,
  keyOnly: true,
} as const;

/**
 * Casa os anúncios novos com os monitores ligados de todos os usuários e grava os alertas (D-32). Roda sem usuário,
 * ao fim de cada coleta: lê os monitores e grava cada alerta com o dono do monitor. Devolve quantos foram criados.
 */
export async function createAlerts(now: Date): Promise<number> {
  const rows = await db.watch.findMany({
    where: { active: true },
    select: { id: true, ownerId: true, alertsFrom: true, ...storedCriteriaSelect },
  });
  const watches = rows.map(({ id, ownerId, alertsFrom, ...stored }): AlertWatch => ({
    id,
    ownerId,
    alertsFrom,
    criteria: criteriaFromStored(stored),
  }));

  const since = alertWindowStart(watches, now);
  if (since === null) return 0;

  const ownerIds = [...new Set(watches.map((watch) => watch.ownerId))];
  const [listings, preferences] = await Promise.all([
    db.listing.findMany({
      where: { firstSeenAt: { gte: since }, status: "open" },
      select: {
        id: true,
        sourceId: true,
        firstSeenAt: true,
        title: true,
        brand: true,
        model: true,
        fipeName: true,
        modelYear: true,
        mileageKm: true,
        category: true,
        fuel: true,
        vehicleOrigin: true,
        hasKey: true,
        damageLevel: true,
        conditionFlags: true,
        inspectionResult: true,
        status: true,
        endsAt: true,
        currentBidCents: true,
        minimumBidCents: true,
        marketValueCents: true,
        municipality: { select: { latitude: true, longitude: true } },
      },
    }),
    db.userPreference.findMany({
      where: { ownerId: { in: ownerIds } },
      select: { ownerId: true, municipality: { select: { latitude: true, longitude: true } } },
    }),
  ]);

  const centerByOwner = new Map<string, Coordinates>();
  for (const pref of preferences) {
    if (pref.municipality) centerByOwner.set(pref.ownerId, pref.municipality);
  }

  // Agrupa monitores por centro de região distinto para evitar recalcular distâncias por dono repetido.
  const watchesByCenter = new Map<string, { center: Coordinates; watches: AlertWatch[] }>();
  for (const watch of watches) {
    const center = centerByOwner.get(watch.ownerId) ?? DEFAULT_REGION.center;
    const key = `${center.latitude},${center.longitude}`;
    const bucket = watchesByCenter.get(key);
    if (bucket) bucket.watches.push(watch);
    else watchesByCenter.set(key, { center, watches: [watch] });
  }

  const planned = [...watchesByCenter.values()].flatMap(({ center, watches: groupWatches }) => {
    const candidates = listings.map(
      ({
        currentBidCents,
        minimumBidCents,
        marketValueCents,
        inspectionResult,
        municipality,
        vehicleOrigin,
        ...listing
      }) => ({
        ...listing,
        inspection: inspectionResult,
        origin: vehicleOrigin,
        currentBid: toCents(currentBidCents),
        minimumBid: toCents(minimumBidCents),
        marketValue: toCents(marketValueCents),
        distanceKm: municipality ? distanceKm(center, municipality) : null,
      }),
    );
    return planAlerts(groupWatches, candidates, now);
  });

  if (planned.length === 0) return 0;
  // Par já alertado é ignorado pelo índice único: mudança no anúncio não gera outro alerta.
  const { count } = await db.alert.createMany({ data: planned, skipDuplicates: true });
  return count;
}
