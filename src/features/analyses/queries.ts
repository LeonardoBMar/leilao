import "server-only";

import { cache } from "react";

import type { AnalysisInputs } from "@/domain/finance/calculator";
import { bps, cents } from "@/domain/money";
import { getLotMarketBands } from "@/features/research/queries";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import { listingFipeOf } from "./draft-defaults";
import { readMarketSnapshot } from "./market-snapshot";
import type { AnalysisDetail, AnalysisVersion, CalibrationItem } from "./types";

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
      marketSnapshot: true,
      createdAt: true,
      updatedAt: true,
      lot: {
        select: {
          id: true,
          lotNumber: true,
          brand: true,
          model: true,
          vehicleVersion: true,
          modelYear: true,
          mileageKm: true,
          lotUrl: true,
          currentBidCents: true,
          auction: { select: { id: true, name: true, city: true, state: true } },
          analyses: { where: { status: "draft" }, select: { id: true } },
          _count: { select: { results: true } },
          listing: {
            select: {
              url: true,
              category: true,
              fuel: true,
              hasKey: true,
              recoveryType: true,
              city: true,
              state: true,
              endsAt: true,
              damageLevel: true,
              conditionFlags: true,
              inspectionResult: true,
              inspectionNotes: true,
              photoUrls: true,
              marketValueCents: true,
              marketValueOrigin: true,
              marketValueRefMonth: true,
              source: { select: { name: true } },
            },
          },
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
    marketSnapshot: readMarketSnapshot(row.marketSnapshot),
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
      auction: { id: lot.auction.id, name: lot.auction.name },
      context: {
        vehicleVersion: lot.vehicleVersion,
        mileageKm: lot.mileageKm,
        lotUrl: lot.lotUrl ?? lot.listing?.url ?? null,
        sourceName: lot.listing?.source.name ?? null,
        city: lot.listing?.city ?? lot.auction.city,
        state: lot.listing?.state ?? lot.auction.state,
        endsAt: lot.listing?.endsAt ?? null,
        fuel: lot.listing?.fuel ?? null,
        hasKey: lot.listing?.hasKey ?? null,
        recoveryType: lot.listing?.recoveryType ?? null,
        damageLevel: lot.listing?.damageLevel ?? null,
        conditionFlags: lot.listing?.conditionFlags ?? [],
        inspection: lot.listing?.inspectionResult ?? null,
        inspectionNotes: lot.listing?.inspectionNotes ?? null,
        listingPhotoUrls: lot.listing?.photoUrls ?? [],
      },
    },
    listingFipe: lot.listing === null ? null : listingFipeOf(lot.listing),
    openDraftId: lot.analyses[0]?.id ?? null,
  };
}

/**
 * Todas as versões de um lote, da mais recente para a mais antiga (RF-05). Memo por requisição (D-44): na ficha do lote,
 * o painel de análises e o próximo passo leem a mesma lista.
 */
export const listLotAnalyses = cache(async (lotId: string): Promise<AnalysisVersion[]> => {
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
});

/**
 * Calibração (docs/PLANO-MERCADO.md §7): a revisão vigente de cada lote do usuário, quando o lote foi arrematado com
 * preço conhecido e a análise vinculada foi fixada antes do desfecho (`prior`, SPEC §10). A faixa da época vem do
 * snapshot da fixação (D-74) ou, nas fixadas antes dele, do recálculo só com as vendas encerradas antes da fixação: a
 * Calibração nunca olha vendas posteriores. Lotes arquivados entram: são histórico.
 */
export async function getCalibration(): Promise<CalibrationItem[]> {
  const user = await requireUser();
  const current = await db.result.findMany({
    where: { ownerId: user.id },
    orderBy: [{ lotId: "asc" }, { revision: "desc" }],
    distinct: ["lotId"],
    select: {
      lotId: true,
      outcome: true,
      finalBidCents: true,
      analysisTiming: true,
      lot: {
        select: { lotNumber: true, brand: true, model: true, modelYear: true, listing: { select: { category: true } } },
      },
      analysis: {
        select: { id: true, status: true, fixedAt: true, isViable: true, maxBidCents: true, marketSnapshot: true },
      },
    },
  });
  const eligible = current.flatMap((result) => {
    const { analysis, lot } = result;
    if (result.outcome !== "sold" || result.finalBidCents === null || result.analysisTiming !== "prior") return [];
    if (analysis === null || analysis.status !== "fixed" || analysis.fixedAt === null) return [];
    const fixedAt = analysis.fixedAt;
    return [
      {
        result,
        analysis,
        lot,
        fixedAt,
        finalBid: cents(result.finalBidCents),
        snapshot: readMarketSnapshot(analysis.marketSnapshot),
      },
    ];
  });
  // Fixadas antes do snapshot (D-74): a faixa da época é recalculada, todas de uma vez (D-79).
  const recomputed = await getLotMarketBands(
    eligible.flatMap((item) => (item.snapshot === null ? [{ lotId: item.result.lotId, until: item.fixedAt }] : [])),
  );
  return eligible
    .map(({ result, analysis, lot, fixedAt, finalBid, snapshot }): CalibrationItem => {
      const band = snapshot === null ? (recomputed.get(result.lotId) ?? null) : snapshot.band;
      return {
        lotId: result.lotId,
        analysisId: analysis.id,
        label: `Lote ${lot.lotNumber} · ${lot.brand} ${lot.model} ${lot.modelYear}`,
        category: lot.listing?.category ?? null,
        fixedAt,
        limit: analysis.isViable && analysis.maxBidCents !== null ? cents(analysis.maxBidCents) : null,
        finalBid,
        band: band === null ? null : { low: band.low, median: band.median, high: band.high },
        bandSource: snapshot === null ? "recomputed" : "snapshot",
      };
    })
    .toSorted((a, b) => b.fixedAt.getTime() - a.fixedAt.getTime());
}
