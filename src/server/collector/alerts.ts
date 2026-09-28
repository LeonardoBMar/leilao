import "server-only";

import { type AlertWatch, alertWindowStart, planAlerts } from "@/domain/listings/alerts";
import { isCategoryKey, isConditionKey } from "@/domain/listings/criteria";
import { distanceKm } from "@/domain/listings/geo";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { cents } from "@/domain/money";

import { db } from "../db";

const toCents = (value: number | null) => (value === null ? null : cents(value));

/**
 * Casa os anúncios novos com os monitores ligados de todos os usuários e grava os alertas (D-32). Roda sem usuário,
 * ao fim de cada coleta: lê os monitores e grava cada alerta com o dono do monitor. Devolve quantos foram criados.
 */
export async function createAlerts(now: Date): Promise<number> {
  const rows = await db.watch.findMany({
    where: { active: true },
    select: {
      id: true,
      ownerId: true,
      alertsFrom: true,
      search: true,
      yearFrom: true,
      yearTo: true,
      maxPriceCents: true,
      radiusKm: true,
      category: true,
      condition: true,
    },
  });
  const watches = rows.flatMap((row): AlertWatch[] => {
    // O banco só aceita chaves conhecidas (CHECK); a checagem aqui só estreita o tipo.
    if (!isCategoryKey(row.category) || !isConditionKey(row.condition)) return [];
    return [
      {
        id: row.id,
        ownerId: row.ownerId,
        alertsFrom: row.alertsFrom,
        criteria: {
          search: row.search,
          yearFrom: row.yearFrom,
          yearTo: row.yearTo,
          maxPrice: toCents(row.maxPriceCents),
          radiusKm: row.radiusKm,
          category: row.category,
          condition: row.condition,
        },
      },
    ];
  });

  const since = alertWindowStart(watches, now);
  if (since === null) return 0;

  const listings = await db.listing.findMany({
    where: { firstSeenAt: { gte: since }, status: "open" },
    select: {
      id: true,
      firstSeenAt: true,
      title: true,
      brand: true,
      model: true,
      fipeName: true,
      modelYear: true,
      category: true,
      damageLevel: true,
      status: true,
      endsAt: true,
      currentBidCents: true,
      minimumBidCents: true,
      municipality: { select: { latitude: true, longitude: true } },
    },
  });
  const candidates = listings.map(({ currentBidCents, minimumBidCents, municipality, ...listing }) => ({
    ...listing,
    currentBid: toCents(currentBidCents),
    minimumBid: toCents(minimumBidCents),
    distanceKm: municipality ? distanceKm(DEFAULT_REGION.center, municipality) : null,
  }));

  const planned = planAlerts(watches, candidates, now);
  if (planned.length === 0) return 0;
  // Par já alertado é ignorado pelo índice único: mudança no anúncio não gera outro alerta.
  const { count } = await db.alert.createMany({ data: planned, skipDuplicates: true });
  return count;
}
