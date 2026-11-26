import "server-only";

import type { AnalysisInputs } from "@/domain/finance/calculator";
import { bps, type Cents, cents } from "@/domain/money";
import {
  calculateRealizedPnl,
  isPaymentOverdue,
  plannedBreakdownFromFixedAnalysis,
  summarizePortfolio,
} from "@/domain/post-auction/pnl";
import type { Prisma } from "@/generated/prisma/client";
import { calendarDateToUtc, toZonedDateInput } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { LotPostAuctionContext, LotPostAuctionRecord, PortfolioLotItem, PortfolioOverview } from "./types";

const money = (value: number | null): Cents | null => (value === null ? null : cents(value));
/** Normaliza um instante UTC (`TIMESTAMPTZ`) para a data de calendário no fuso do app (meia-noite UTC). */
const toAppCalendarDate = (instant: Date): Date => calendarDateToUtc(toZonedDateInput(instant)) ?? instant;

const analysisSelect = {
  id: true,
  version: true,
  status: true,
  formulaVersion: true,
  marketValueCents: true,
  repairCostCents: true,
  documentationCostCents: true,
  transportCostCents: true,
  tiresCostCents: true,
  serviceCostCents: true,
  otherFeesCents: true,
  debtsCostCents: true,
  sellingCostCents: true,
  taxCostCents: true,
  commissionMode: true,
  commissionFixedCents: true,
  commissionRateBps: true,
  riskReserveCents: true,
  desiredMarginCents: true,
  riskReserveBps: true,
  desiredMarginBps: true,
} satisfies Prisma.AnalysisSelect;

type AnalysisRow = Prisma.AnalysisGetPayload<{ select: typeof analysisSelect }>;

function toDomainInputs(row: AnalysisRow): AnalysisInputs {
  return {
    marketValue: money(row.marketValueCents),
    repairCost: money(row.repairCostCents),
    documentationCost: money(row.documentationCostCents),
    transportCost: money(row.transportCostCents),
    tiresCost: money(row.tiresCostCents),
    serviceCost: money(row.serviceCostCents),
    otherFees: money(row.otherFeesCents),
    debtsCost: money(row.debtsCostCents),
    sellingCost: money(row.sellingCostCents),
    taxCost: money(row.taxCostCents),
    commissionMode: row.commissionMode,
    commissionFixed: money(row.commissionFixedCents),
    commissionRateBps: row.commissionRateBps === null ? null : bps(row.commissionRateBps),
    riskReserve: money(row.riskReserveCents),
    riskReserveRateBps: row.riskReserveBps === null ? null : bps(row.riskReserveBps),
    desiredMargin: money(row.desiredMarginCents),
    desiredMarginRateBps: row.desiredMarginBps === null ? null : bps(row.desiredMarginBps),
  };
}

const DEFAULT_RECORD: LotPostAuctionRecord = {
  status: "acquired",
  paymentDueAt: null,
  paidAt: null,
  pickedUpAt: null,
  docReceivedAt: null,
  listedAt: null,
  soldAt: null,
  salePrice: null,
  privatePlate: null,
  notes: null,
  updatedAt: null,
};

/**
 * Contexto pós-arremate de um lote (D-96). Devolve `null` se o lote não existir, for de outro dono
 * ou não tiver revisão vigente com `personalOutcome = "won"` e preço final.
 */
export async function getLotPostAuctionContext(lotId: string): Promise<LotPostAuctionContext | null> {
  const user = await requireUser();
  const lot = await db.lot.findFirst({
    where: { id: lotId, ownerId: user.id },
    select: {
      id: true,
      results: {
        orderBy: { revision: "desc" },
        take: 1,
        select: {
          outcome: true,
          personalOutcome: true,
          finalBidCents: true,
          eventAt: true,
          recordedAt: true,
          analysis: { select: analysisSelect },
        },
      },
      postAuction: {
        select: {
          status: true,
          paymentDueAt: true,
          paidAt: true,
          pickedUpAt: true,
          docReceivedAt: true,
          listedAt: true,
          soldAt: true,
          salePriceCents: true,
          privatePlate: true,
          notes: true,
          updatedAt: true,
        },
      },
      expenses: {
        orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          category: true,
          description: true,
          amountCents: true,
          incurredAt: true,
        },
      },
    },
  });

  if (!lot) return null;
  const currentResult = lot.results[0];
  if (!currentResult || currentResult.personalOutcome !== "won" || currentResult.finalBidCents === null) {
    return null;
  }

  const finalBid = cents(currentResult.finalBidCents);
  const acquiredAt = currentResult.eventAt ?? currentResult.recordedAt;
  const record: LotPostAuctionRecord = lot.postAuction
    ? {
        status: lot.postAuction.status,
        paymentDueAt: lot.postAuction.paymentDueAt,
        paidAt: lot.postAuction.paidAt,
        pickedUpAt: lot.postAuction.pickedUpAt,
        docReceivedAt: lot.postAuction.docReceivedAt,
        listedAt: lot.postAuction.listedAt,
        soldAt: lot.postAuction.soldAt,
        salePrice: money(lot.postAuction.salePriceCents),
        privatePlate: lot.postAuction.privatePlate,
        notes: lot.postAuction.notes,
        updatedAt: lot.postAuction.updatedAt,
      }
    : DEFAULT_RECORD;

  const expenses = lot.expenses.map((expense) => ({
    id: expense.id,
    category: expense.category,
    description: expense.description,
    amount: cents(expense.amountCents),
    incurredAt: expense.incurredAt,
  }));

  const fixedAnalysis =
    currentResult.analysis?.status === "fixed" && currentResult.analysis.formulaVersion !== null
      ? currentResult.analysis
      : null;

  const planned =
    fixedAnalysis === null
      ? null
      : plannedBreakdownFromFixedAnalysis(toDomainInputs(fixedAnalysis), fixedAnalysis.formulaVersion ?? 1, finalBid);

  const today = toAppCalendarDate(new Date());
  const acquiredDate = toAppCalendarDate(acquiredAt);
  const isSold = record.status === "sold";
  const pnl = calculateRealizedPnl({
    finalBid,
    expenses: expenses.map(({ category, amount }) => ({ category, amount })),
    salePrice: isSold ? record.salePrice : null,
    planned,
    acquiredAt: acquiredDate,
    listedAt: record.listedAt,
    soldAt: isSold ? record.soldAt : null,
    now: today,
  });

  return {
    lotId: lot.id,
    finalBid,
    acquiredAt,
    analysisId: fixedAnalysis?.id ?? null,
    analysisVersion: fixedAnalysis?.version ?? null,
    record,
    expenses,
    pnl,
    isPaymentOverdue: isPaymentOverdue(record.paymentDueAt, record.paidAt, today),
  };
}

/** Carteira consolidada de todos os lotes arrematados pelo usuário (aba Carteira em Minhas análises, D-96). */
export async function getPortfolioOverview(): Promise<PortfolioOverview> {
  const user = await requireUser();
  const currentResults = await db.result.findMany({
    where: { ownerId: user.id },
    orderBy: [{ lotId: "asc" }, { revision: "desc" }],
    distinct: ["lotId"],
    select: {
      lotId: true,
      personalOutcome: true,
      finalBidCents: true,
      eventAt: true,
      recordedAt: true,
      lot: {
        select: {
          lotNumber: true,
          brand: true,
          model: true,
          modelYear: true,
          auction: { select: { name: true } },
          postAuction: {
            select: {
              status: true,
              paymentDueAt: true,
              paidAt: true,
              listedAt: true,
              soldAt: true,
              salePriceCents: true,
            },
          },
          expenses: {
            select: { category: true, amountCents: true },
          },
        },
      },
    },
  });

  const today = toAppCalendarDate(new Date());
  const wonEntries = currentResults.flatMap((result) => {
    if (result.personalOutcome !== "won" || result.finalBidCents === null) return [];
    const finalBid = cents(result.finalBidCents);
    const acquiredAt = result.eventAt ?? result.recordedAt;
    const acquiredDate = toAppCalendarDate(acquiredAt);
    const status = result.lot.postAuction?.status ?? "acquired";
    const isSold = status === "sold";
    const paymentDueAt = result.lot.postAuction?.paymentDueAt ?? null;
    const paidAt = result.lot.postAuction?.paidAt ?? null;
    const listedAt = result.lot.postAuction?.listedAt ?? null;
    const soldAt = isSold ? (result.lot.postAuction?.soldAt ?? null) : null;
    const salePrice = isSold ? money(result.lot.postAuction?.salePriceCents ?? null) : null;

    const pnl = calculateRealizedPnl({
      finalBid,
      expenses: result.lot.expenses.map((expense) => ({
        category: expense.category,
        amount: cents(expense.amountCents),
      })),
      salePrice,
      planned: null,
      acquiredAt: acquiredDate,
      listedAt,
      soldAt,
      now: today,
    });

    const item: PortfolioLotItem = {
      lotId: result.lotId,
      lotNumber: result.lot.lotNumber,
      title: `${result.lot.brand} ${result.lot.model} ${result.lot.modelYear}`,
      auctionName: result.lot.auction.name,
      status,
      acquiredAt,
      paymentDueAt,
      paidAt,
      soldAt,
      isPaymentOverdue: isPaymentOverdue(paymentDueAt, paidAt, today),
      finalBid,
      totalExpenses: pnl.totalExpenses,
      totalInvested: pnl.totalInvested,
      salePrice,
      realizedProfit: pnl.realizedProfit,
      realizedRoiRatio: pnl.realizedRoiRatio,
      holdDays: pnl.holdDays,
    };

    return [{ item, summaryInput: { status, paymentDueAt, paidAt, salePrice, pnl } }];
  });

  const summary = summarizePortfolio(
    wonEntries.map((entry) => entry.summaryInput),
    today,
  );

  // Em operação primeiro (vencidos no topo, depois mais recentes); vendidos por data de venda decrescente.
  const items = wonEntries
    .map((entry) => entry.item)
    .toSorted((a, b) => {
      const aSold = a.status === "sold" ? 1 : 0;
      const bSold = b.status === "sold" ? 1 : 0;
      if (aSold !== bSold) return aSold - bSold;
      if (a.isPaymentOverdue !== b.isPaymentOverdue) return a.isPaymentOverdue ? -1 : 1;
      const aTime = (a.soldAt ?? a.acquiredAt)?.getTime() ?? 0;
      const bTime = (b.soldAt ?? b.acquiredAt)?.getTime() ?? 0;
      return bTime - aTime;
    });

  return { summary, items };
}
