import "server-only";

import { vehicleKey } from "@/domain/listings/vehicle-key";
import { db } from "@/server/db";

/**
 * Recalcula a chave do veículo gravada (`vehicle_key`, D-77) de todo o catálogo: a coleta grava a cada visita, e isto
 * preenche o acervo e refaz os anúncios que ela não visita mais depois de uma mudança na regra (`vehicleKey`).
 * Idempotente: só atualiza o anúncio cuja chave mudou. Trabalha pelas combinações distintas de marca e modelo (poucos
 * milhares), não anúncio a anúncio.
 */
export async function backfillVehicleKeys(): Promise<{ keys: number; updated: number }> {
  const combos = await db.listing.findMany({
    distinct: ["brand", "model"],
    select: { brand: true, model: true },
  });
  const byKey = new Map<string | null, typeof combos>();
  for (const combo of combos) {
    const key = vehicleKey(combo.brand, combo.model);
    byKey.set(key, [...(byKey.get(key) ?? []), combo]);
  }

  let updated = 0;
  for (const [key, items] of byKey) {
    const { count } = await db.listing.updateMany({
      where: {
        AND: [
          { OR: items },
          key === null ? { vehicleKey: { not: null } } : { OR: [{ vehicleKey: null }, { vehicleKey: { not: key } }] },
        ],
      },
      data: { vehicleKey: key },
    });
    updated += count;
  }
  return { keys: byKey.size, updated };
}
