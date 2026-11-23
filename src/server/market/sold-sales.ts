import "server-only";

import type { BacktestSale } from "@/domain/listings/backtest";
import {
  buildEstimateIndex,
  type EstimateIndex,
  type EstimateSale,
  SALES_WINDOW_MS,
} from "@/domain/listings/estimates";
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

const ESTIMATE_INDEX_TTL_MS = 15 * 60 * 1000;

let cachedEstimateIndex: { index: EstimateIndex; expiresAt: number } | null = null;
let inFlightEstimateIndex: Promise<EstimateIndex> | null = null;

/**
 * Índice de vendas das estimativas em cache de processo (TTL 15 min, alinhado ao perfil `catalog` de D-78; D-85).
 * Evita desserializar milhares de linhas (~4,6 MB) e reconstruir o `EstimateIndex` (~150 ms CPU) a cada requisição,
 * deduplicando cargas concorrentes em cold start. Catálogo global, sem sessão (quem chama exige `requireUser`).
 */
export async function getRecentEstimateIndex(now: Date = new Date()): Promise<EstimateIndex> {
  const nowMs = now.getTime();
  if (cachedEstimateIndex && cachedEstimateIndex.expiresAt > nowMs) {
    return cachedEstimateIndex.index;
  }
  if (!inFlightEstimateIndex) {
    inFlightEstimateIndex = db.listing
      .findMany({
        where: { ...soldSaleWhere, endsAt: { gte: new Date(nowMs - SALES_WINDOW_MS) } },
        select: estimateSaleSelect,
      })
      .then((rows) => {
        const sales = rows.flatMap((row) => toEstimateSale(row) ?? []);
        const index = buildEstimateIndex(sales);
        cachedEstimateIndex = { index, expiresAt: Date.now() + ESTIMATE_INDEX_TTL_MS };
        return index;
      })
      .finally(() => {
        inFlightEstimateIndex = null;
      });
  }
  return inFlightEstimateIndex;
}

/**
 * Todas as vendas do catálogo, para o backtest do preço provável (docs/PLANO-MERCADO.md, T0.1). Catálogo global, sem
 * dono (D-45); só os scripts usam, e só leem.
 */
export async function loadSoldSales(): Promise<BacktestSale[]> {
  const rows = await db.listing.findMany({ where: soldSaleWhere, select: estimateSaleSelect });
  return rows.flatMap((row) => toEstimateSale(row) ?? []);
}
