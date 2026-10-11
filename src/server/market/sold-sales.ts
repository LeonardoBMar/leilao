import "server-only";

import type { BacktestSale } from "@/domain/listings/backtest";
import { cents } from "@/domain/money";
import { db } from "@/server/db";

/**
 * Todas as vendas do catálogo (situação vendido, lance final positivo), para o backtest do preço provável
 * (docs/PLANO-MERCADO.md, T0.1). Catálogo global, sem dono (D-45); só os scripts usam, e só leem.
 */
export async function loadSoldSales(): Promise<BacktestSale[]> {
  const rows = await db.listing.findMany({
    where: { status: "sold", finalBidCents: { gt: 0 }, endsAt: { not: null } },
    select: {
      id: true,
      endsAt: true,
      brand: true,
      model: true,
      modelYear: true,
      mileageKm: true,
      category: true,
      damageLevel: true,
      finalBidCents: true,
      marketValueCents: true,
    },
  });
  return rows.flatMap(({ endsAt, finalBidCents, marketValueCents, ...row }) =>
    endsAt === null || finalBidCents === null
      ? []
      : [
          {
            ...row,
            endsAt,
            finalBid: cents(finalBidCents),
            marketValue: marketValueCents === null ? null : cents(marketValueCents),
          },
        ],
  );
}
