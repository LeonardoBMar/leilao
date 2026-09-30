import "server-only";

import { planTracker, type TrackerSuggestions } from "@/domain/listings/tracker";
import { bps, cents } from "@/domain/money";
import type { Prisma } from "@/generated/prisma/client";
import { calendarDateToUtc, toCalendarDateInput } from "@/lib/dates";
import { formatBps, formatBRL } from "@/lib/format";
import { err, ok, type Result } from "@/lib/result";
import { requireUser } from "@/server/auth";
import { db, isUniqueViolation } from "@/server/db";

/** Leilão, lote e rascunho em sequência: com o banco nos EUA, o padrão de 5 s é curto. */
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

const toCents = (value: number | null) => (value === null ? null : cents(value));

export type AddToTrackerError = "not_found" | "incomplete" | "lot_number_taken";

export type AddToTrackerOutcome =
  /** Lote novo, com o rascunho preenchido pelas sugestões da fonte. */
  | { kind: "created"; lotId: string; analysisId: string }
  /** O anúncio já estava no Tracker (ou foi ligado a um lote igual, cadastrado à mão). */
  | { kind: "existing"; lotId: string };

/**
 * "Adicionar à análise" (docs/PLANO-COLETA.md, etapa 3; D-34): cria leilão, lote e rascunho a partir do anúncio.
 * Não duplica: o leilão é um por leilão da fonte e o lote, um por anúncio (índices únicos por dono).
 */
export async function addListingToTracker(listingId: string): Promise<Result<AddToTrackerOutcome, AddToTrackerError>> {
  const user = await requireUser();

  const linked = await db.lot.findFirst({ where: { ownerId: user.id, listingId }, select: { id: true } });
  if (linked) return ok({ kind: "existing", lotId: linked.id });

  const listing = await db.listing.findUnique({ where: { id: listingId }, select: trackerSelect });
  if (!listing) return err("not_found");

  const now = new Date();
  const planned = planTracker(
    {
      sourceId: listing.sourceId,
      sourceName: listing.source.name,
      externalId: listing.externalId,
      url: listing.url,
      lotNumber: listing.lotNumber,
      brand: listing.brand,
      model: listing.model,
      fipeName: listing.fipeName,
      modelYear: listing.modelYear,
      manufactureYear: listing.manufactureYear,
      mileageKm: listing.mileageKm,
      recoveryType: listing.recoveryType,
      auctionExternalId: listing.auctionExternalId,
      auctionName: listing.auctionName,
      auctionStartsAt: listing.auctionStartsAt,
      startsAt: listing.startsAt,
      endsAt: listing.endsAt,
      status: listing.status,
      currentBid: toCents(listing.currentBidCents),
      minimumBid: toCents(listing.minimumBidCents),
      marketValue: toCents(listing.marketValueCents),
      commissionRate: listing.commissionBps === null ? null : bps(listing.commissionBps),
      dispatcherFee: toCents(listing.dispatcherFeeCents),
      removalFee: toCents(listing.removalFeeCents),
      storageFee: toCents(listing.storageFeeCents),
      inspectionFee: toCents(listing.inspectionFeeCents),
      otherFees: toCents(listing.otherFeesCents),
      lastCheckedAt: listing.lastCheckedAt,
    },
    now,
  );
  // A tela só oferece o botão com marca, modelo e ano; aqui cobre o anúncio que mudou nesse meio-tempo.
  if (!planned.ok) return err("incomplete");
  const { auction, lot, suggestions } = planned.value;
  const sourceName = listing.source.name;

  try {
    return await db.$transaction(async (tx) => {
      const { id: auctionId } = await tx.auction.upsert({
        where: {
          ownerId_sourceId_externalId: { ownerId: user.id, sourceId: auction.sourceId, externalId: auction.externalId },
        },
        create: { ...auction, ownerId: user.id },
        // Leilão arquivado volta às visões ativas junto com o lote novo.
        update: { archivedAt: null },
        select: { id: true },
      });

      // Mesmo número já cadastrado à mão neste leilão: liga o lote existente em vez de duplicar.
      const sameNumber = await tx.lot.findFirst({
        where: { ownerId: user.id, auctionId, lotNumber: lot.lotNumber },
        select: { id: true, listingId: true },
      });
      if (sameNumber) {
        // Clique repetido que chegou depois do primeiro gravar: é o mesmo lote.
        if (sameNumber.listingId === listingId) return ok({ kind: "existing", lotId: sameNumber.id } as const);
        if (sameNumber.listingId !== null) {
          return err("lot_number_taken");
        }
        await tx.lot.updateMany({ where: { id: sameNumber.id, ownerId: user.id }, data: { listingId } });
        return ok({ kind: "existing", lotId: sameNumber.id } as const);
      }

      const { currentBid, startingBid, ...lotFields } = lot;
      const created = await tx.lot.create({
        data: {
          ...lotFields,
          ownerId: user.id,
          auctionId,
          listingId,
          startingBidCents: startingBid,
          currentBidCents: currentBid,
          isFollowed: true,
        },
        select: { id: true },
      });
      const analysis = await tx.analysis.create({
        data: {
          ownerId: user.id,
          lotId: created.id,
          version: 1,
          status: "draft",
          ...draftFromSuggestions(suggestions, sourceName),
        },
        select: { id: true },
      });
      return ok({ kind: "created", lotId: created.id, analysisId: analysis.id } as const);
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    // Dois cliques em paralelo: o índice único (dono, anúncio) barra o segundo, que usa o lote do primeiro. Se quem
    // colidiu foi o leilão (upsert simultâneo), ainda não há lote: o erro segue para o error.tsx e um novo clique resolve.
    if (!isUniqueViolation(error)) throw error;
    const winner = await db.lot.findFirst({ where: { ownerId: user.id, listingId }, select: { id: true } });
    if (!winner) throw error;
    return ok({ kind: "existing", lotId: winner.id });
  }
}

/** Sugestões da fonte → colunas do rascunho, com a origem registrada na referência e nas observações (D-30). */
function draftFromSuggestions(suggestions: TrackerSuggestions, sourceName: string) {
  const referenceDate = calendarDateToUtc(toCalendarDateInput(suggestions.referenceDate));
  const lines = [
    suggestions.marketValue === null ? null : `valor de mercado ${formatBRL(suggestions.marketValue)}`,
    suggestions.commissionRate === null ? null : `comissão ${formatBps(suggestions.commissionRate)}`,
    suggestions.documentationCost === null ? null : `despachante ${formatBRL(suggestions.documentationCost)}`,
    suggestions.transportCost === null ? null : `remoção ${formatBRL(suggestions.transportCost)} (transporte)`,
    suggestions.otherFees === null ? null : `depósito, vistoria e outras ${formatBRL(suggestions.otherFees)}`,
  ].filter((line) => line !== null);

  return {
    marketValueCents: suggestions.marketValue,
    marketReferenceDate: suggestions.marketValue === null ? null : referenceDate,
    marketReferenceSource: suggestions.marketValue === null ? null : `${sourceName} (informado no anúncio)`,
    commissionMode: suggestions.commissionRate === null ? null : ("percentage" as const),
    commissionRateBps: suggestions.commissionRate,
    documentationCostCents: suggestions.documentationCost,
    transportCostCents: suggestions.transportCost,
    otherFeesCents: suggestions.otherFees,
    notes:
      lines.length === 0
        ? null
        : `Preenchido com o anúncio no ${sourceName} (revise antes de fixar): ${lines.join("; ")}. ` +
          "Reparos, pneus, revisão, reserva e margem ficam com você.",
  };
}

const trackerSelect = {
  sourceId: true,
  externalId: true,
  url: true,
  lotNumber: true,
  brand: true,
  model: true,
  fipeName: true,
  modelYear: true,
  manufactureYear: true,
  mileageKm: true,
  recoveryType: true,
  auctionExternalId: true,
  auctionName: true,
  auctionStartsAt: true,
  startsAt: true,
  endsAt: true,
  status: true,
  currentBidCents: true,
  minimumBidCents: true,
  marketValueCents: true,
  commissionBps: true,
  dispatcherFeeCents: true,
  removalFeeCents: true,
  storageFeeCents: true,
  inspectionFeeCents: true,
  otherFeesCents: true,
  lastCheckedAt: true,
  source: { select: { name: true } },
} satisfies Prisma.ListingSelect;
