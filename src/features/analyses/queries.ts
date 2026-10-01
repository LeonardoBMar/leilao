import "server-only";

import type { AnalysisInputs } from "@/domain/finance/calculator";
import { bps, cents } from "@/domain/money";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { AnalysisDetail, AnalysisVersion } from "./types";

const money = (value: number | null) => (value === null ? null : cents(value));

export const analysisColumns = {
  marketValueCents: true,
  repairCostCents: true,
  documentationCostCents: true,
  transportCostCents: true,
  tiresCostCents: true,
  serviceCostCents: true,
  otherFeesCents: true,
  commissionMode: true,
  commissionFixedCents: true,
  commissionRateBps: true,
  riskReserveCents: true,
  desiredMarginCents: true,
  riskReserveBps: true,
  desiredMarginBps: true,
} satisfies Prisma.AnalysisSelect;

type InputRow = Prisma.AnalysisGetPayload<{ select: typeof analysisColumns }>;

/** Colunas do banco → entradas do domínio. */
export function toInputs(row: InputRow): AnalysisInputs {
  return {
    marketValue: money(row.marketValueCents),
    repairCost: money(row.repairCostCents),
    documentationCost: money(row.documentationCostCents),
    transportCost: money(row.transportCostCents),
    tiresCost: money(row.tiresCostCents),
    serviceCost: money(row.serviceCostCents),
    otherFees: money(row.otherFeesCents),
    commissionMode: row.commissionMode,
    commissionFixed: money(row.commissionFixedCents),
    commissionRateBps: row.commissionRateBps === null ? null : bps(row.commissionRateBps),
    riskReserve: money(row.riskReserveCents),
    riskReserveRateBps: row.riskReserveBps === null ? null : bps(row.riskReserveBps),
    desiredMargin: money(row.desiredMarginCents),
    desiredMarginRateBps: row.desiredMarginBps === null ? null : bps(row.desiredMarginBps),
  };
}

/** `null` para inexistente ou de outro dono; quem renderiza decide `notFound()`. */
export async function getAnalysis(id: string): Promise<AnalysisDetail | null> {
  const user = await requireUser();
  const row = await db.analysis.findFirst({
    where: { id, ownerId: user.id },
    select: {
      id: true,
      version: true,
      status: true,
      ...analysisColumns,
      marketReferenceDate: true,
      marketReferenceSource: true,
      fipeValueCents: true,
      fipeReferenceMonth: true,
      fipeReferenceSource: true,
      notes: true,
      knownResultAtCreation: true,
      isViable: true,
      maxBidCents: true,
      totalAtMaxBidCents: true,
      marginAtMaxBidCents: true,
      formulaVersion: true,
      fixedAt: true,
      createdAt: true,
      updatedAt: true,
      lot: {
        select: {
          id: true,
          lotNumber: true,
          brand: true,
          model: true,
          modelYear: true,
          currentBidCents: true,
          auction: { select: { id: true, name: true } },
          analyses: { where: { status: "draft" }, select: { id: true } },
          _count: { select: { results: true } },
          listing: { select: { category: true, damageLevel: true, conditionFlags: true } },
        },
      },
    },
  });
  if (!row) return null;

  const { lot } = row;
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    inputs: toInputs(row),
    references: {
      marketReferenceDate: row.marketReferenceDate,
      marketReferenceSource: row.marketReferenceSource,
      fipeValue: money(row.fipeValueCents),
      fipeReferenceMonth: row.fipeReferenceMonth,
      fipeReferenceSource: row.fipeReferenceSource,
      notes: row.notes,
      knownResultAtCreation: row.knownResultAtCreation,
    },
    outputs:
      row.status === "fixed" && row.isViable !== null && row.formulaVersion !== null
        ? {
            isViable: row.isViable,
            maxBid: money(row.maxBidCents),
            totalAtMaxBid: money(row.totalAtMaxBidCents),
            marginAtMaxBid: money(row.marginAtMaxBidCents),
            formulaVersion: row.formulaVersion,
          }
        : null,
    fixedAt: row.fixedAt,
    createdAt: row.createdAt,
    // Sem anúncio ligado, o botão "Estimar a partir da FIPE" supõe carro sem sinistro declarado.
    vehicle: {
      isMotorcycle: lot.listing?.category === "Motos",
      damageLevel: lot.listing?.damageLevel ?? null,
      airbagDeployed: lot.listing?.conditionFlags.includes("airbag_deployed") ?? false,
      missingParts: lot.listing?.conditionFlags.includes("missing_parts") ?? false,
    },
    updatedAt: row.updatedAt,
    lot: {
      id: lot.id,
      lotNumber: lot.lotNumber,
      title: `${lot.brand} ${lot.model} ${lot.modelYear}`,
      currentBid: money(lot.currentBidCents),
      hasResult: lot._count.results > 0,
      auction: lot.auction,
    },
    openDraftId: lot.analyses[0]?.id ?? null,
  };
}

/** Todas as versões de um lote, da mais recente para a mais antiga (RF-05). */
export async function listLotAnalyses(lotId: string): Promise<AnalysisVersion[]> {
  const user = await requireUser();
  const rows = await db.analysis.findMany({
    where: { lotId, ownerId: user.id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      status: true,
      isViable: true,
      maxBidCents: true,
      knownResultAtCreation: true,
      fixedAt: true,
      updatedAt: true,
    },
  });
  return rows.map(({ maxBidCents, ...row }) => ({ ...row, maxBid: money(maxBidCents) }));
}
