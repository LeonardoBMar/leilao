import "server-only";

import { inferOrigin, type VehicleOrigin } from "@/domain/listings/origin";
import { db } from "@/server/db";

/**
 * Recalcula a origem gravada (`vehicle_origin`, D-73) de todo o catálogo: a coleta grava a cada visita, e isto refaz
 * os anúncios que ela não visita mais depois de uma mudança na regra (`inferOrigin`). Idempotente: só atualiza o
 * anúncio cuja origem mudou. Trabalha pelas combinações distintas de fonte, retomada e comitente (centenas), não
 * anúncio a anúncio.
 */
export async function backfillOrigins(): Promise<Record<VehicleOrigin, number>> {
  const combos = await db.listing.findMany({
    distinct: ["sourceId", "recoveryType", "sellerName"],
    select: { sourceId: true, recoveryType: true, sellerName: true },
  });
  const byOrigin = new Map<VehicleOrigin, typeof combos>();
  for (const combo of combos) {
    const origin = inferOrigin(combo);
    byOrigin.set(origin, [...(byOrigin.get(origin) ?? []), combo]);
  }

  const updated: Record<VehicleOrigin, number> = {
    financiamento: 0,
    seguradora: 0,
    frota: 0,
    orgao_publico: 0,
    outros: 0,
  };
  for (const [origin, items] of byOrigin) {
    const { count } = await db.listing.updateMany({
      where: { vehicleOrigin: { not: origin }, OR: items },
      data: { vehicleOrigin: origin },
    });
    updated[origin] = count;
  }
  return updated;
}
