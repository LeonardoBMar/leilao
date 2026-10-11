import "server-only";

import type { BacktestSale } from "@/domain/listings/backtest";
import type { EstimateSale } from "@/domain/listings/estimates";
import { cents } from "@/domain/money";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/** Vendas do catálogo: situação vendido e lance final positivo (base das estimativas, D-28). */
export const soldSaleWhere = {
  status: "sold",
  finalBidCents: { gt: 0 },
  endsAt: { not: null },
} satisfies Prisma.ListingWhereInput;

/** Campos de uma venda para as estimativas (D-36, D-72). */
export const estimateSaleSelect = {
  id: true,
  endsAt: true,
  brand: true,
  model: true,
  modelYear: true,
  mileageKm: true,
  category: true,
  damageLevel: true,
  fipeCode: true,
  marketValueFipeCode: true,
  vehicleOrigin: true,
  finalBidCents: true,
  marketValueCents: true,
} satisfies Prisma.ListingSelect;

type EstimateSaleRow = Prisma.ListingGetPayload<{ select: typeof estimateSaleSelect }>;

/** Linha → venda das estimativas; `null` sem fim ou sem lance final (o `where` já garante, o tipo não). */
export function toEstimateSale(row: EstimateSaleRow): EstimateSale | null {
  const { endsAt, finalBidCents, marketValueCents, fipeCode, marketValueFipeCode, vehicleOrigin, ...vehicle } = row;
  if (endsAt === null || finalBidCents === null) return null;
  return {
    ...vehicle,
    endsAt,
    // A versão casada na FIPE (D-47) vale tanto quanto a da fonte; a da fonte vem primeiro quando há as duas.
    fipeCode: fipeCode ?? marketValueFipeCode,
    origin: vehicleOrigin,
    finalBid: cents(finalBidCents),
    marketValue: marketValueCents === null ? null : cents(marketValueCents),
  };
}

/**
 * Todas as vendas do catálogo, para o backtest do preço provável (docs/PLANO-MERCADO.md, T0.1). Catálogo global, sem
 * dono (D-45); só os scripts usam, e só leem.
 */
export async function loadSoldSales(): Promise<BacktestSale[]> {
  const rows = await db.listing.findMany({ where: soldSaleWhere, select: estimateSaleSelect });
  return rows.flatMap((row) => toEstimateSale(row) ?? []);
}
