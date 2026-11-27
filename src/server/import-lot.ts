import "server-only";

import { calculateMaxBid } from "@/domain/finance/calculator";
import { defaultAssumptions, type UserDefaultOverrides } from "@/domain/finance/defaults";
import { type ImportPreviewResult, parseExternalLot } from "@/domain/import/universal";
import type { DamageLevel } from "@/domain/listings/condition";
import { estimatePrice } from "@/domain/listings/estimates";
import { type Bps, bps, type Cents, cents } from "@/domain/money";
import { calendarDateToUtc, toZonedDateInput } from "@/lib/dates";
import { formatBps, formatBRL } from "@/lib/format";
import { err, ok, type Result } from "@/lib/result";
import { db, isUniqueViolation } from "@/server/db";
import { lookupVehicleFipe } from "@/server/fipe/lookup";
import { fetchExternalLotHtml, type SafeFetchError } from "@/server/import-fetch";
import { getRecentEstimateIndex } from "@/server/market/sold-sales";
import { redactVehicleIds } from "@/sources/shared/redact";

/**
 * Serviço de importação universal de lotes externos (D-98).
 * Compartilhado entre a tela `/minhas-analises/importar` (sessão via `requireUser`)
 * e a API v1 `POST /api/v1/lots/import` (Bearer token via `authenticateBearerRequest`).
 */

export const FETCH_ERROR_NOTICES: Record<SafeFetchError, string> = {
  invalid_url: "A URL informada não é válida. Confira o endereço ou cole o texto da página.",
  blocked_host: "Endereço não permitido para busca automática. Cole o texto da página abaixo.",
  blocked_by_site:
    "Este leiloeiro bloqueou o acesso automático pela nuvem (proteção anti-robô). Abra a página no navegador, pressione Ctrl+A → Ctrl+C e cole o texto abaixo.",
  too_large: "A página excede o limite de 2 MB. Copie e cole apenas o texto do lote abaixo.",
  network_error: "Não foi possível carregar a URL agora. Copie e cole o texto da página abaixo.",
};

/** Extrai dados de uma URL e/ou texto colado, casa na FIPE do banco e calcula a faixa de mercado. */
export async function previewExternalLot(input: {
  url?: string;
  rawText?: string;
}): Promise<Result<ImportPreviewResult, SafeFetchError>> {
  let content = input.rawText?.trim() ?? "";
  let resolvedUrl = input.url?.trim() || null;

  if (!content && resolvedUrl) {
    const fetched = await fetchExternalLotHtml(resolvedUrl);
    if (!fetched.ok) return err(fetched.error);
    content = fetched.value.html;
    resolvedUrl = fetched.value.url;
  }

  const parsed = parseExternalLot({ url: resolvedUrl, content });

  const fipe = await lookupVehicleFipe({
    brand: parsed.brand,
    model: parsed.model,
    vehicleVersion: parsed.vehicleVersion,
    modelYear: parsed.modelYear,
    fuel: parsed.fuel,
    isMotorcycle: parsed.isMotorcycle,
  });

  let market: ImportPreviewResult["market"] = null;
  if (parsed.brand && parsed.model && parsed.modelYear !== null) {
    const index = await getRecentEstimateIndex();
    market = estimatePrice(
      {
        brand: parsed.brand,
        model: parsed.model,
        modelYear: parsed.modelYear,
        mileageKm: parsed.mileageKm,
        category: parsed.isMotorcycle ? "Motos" : "Carros",
        damageLevel: parsed.damageLevel,
        fipeCode: fipe?.fipeCode ?? null,
        origin: null,
        marketValue: fipe?.value ?? null,
      },
      index,
    );
  }

  const todayPart = toZonedDateInput(new Date()).slice(5, 10).replace("-", "");
  const suffix = crypto.randomUUID().slice(0, 4).toUpperCase();
  const suggestedLotNumber = parsed.lotNumber ?? `IMP-${todayPart}-${suffix}`;

  return ok({ parsed, suggestedLotNumber, fipe, market });
}

export type ExternalLotCreateInput = {
  auctioneer: string;
  auctionName: string;
  lotNumber: string;
  brand: string;
  model: string;
  vehicleVersion: string | null;
  manufactureYear: number | null;
  modelYear: number;
  mileageKm: number | null;
  fuel: string | null;
  damageLevel: DamageLevel | null;
  isMotorcycle: boolean;
  currentBidCents: Cents | null;
  commissionRateBps: Bps | null;
  otherFeesCents: Cents | null;
  fipeValueCents: Cents | null;
  fipeRefMonth: Date | null;
  city: string | null;
  state: string | null;
  startsAt: Date | null;
  lotUrl: string | null;
  notes: string | null;
};

export type ImportedLotOutcome = {
  auctionId: string;
  lotId: string;
  analysisId: string;
  maxBidCents: Cents | null;
  isViable: boolean | null;
  fipeCents: Cents | null;
  marketBand: { lowCents: Cents; medianCents: Cents; highCents: Cents; sampleSize: number; basis: string } | null;
};

export type ImportLotError = "duplicate_lot_number";

async function loadOwnerCostOverrides(ownerId: string): Promise<UserDefaultOverrides> {
  const row = await db.userPreference.findUnique({
    where: { ownerId },
    select: {
      buyerProfile: true,
      desiredMarginRateBps: true,
      riskReserveRateBps: true,
      documentationCost: true,
      towBase: true,
      towPerKm: true,
      towUnknownDistance: true,
      saleDiscountNoneBps: true,
      saleDiscountSmallBps: true,
      saleDiscountMediumBps: true,
      saleDiscountLargeBps: true,
    },
  });
  if (!row) return {};
  return {
    buyerProfile: row.buyerProfile,
    desiredMarginRateBps: row.desiredMarginRateBps === null ? null : bps(row.desiredMarginRateBps),
    riskReserveRateBps: row.riskReserveRateBps === null ? null : bps(row.riskReserveRateBps),
    documentationCost: row.documentationCost === null ? null : cents(row.documentationCost),
    towBase: row.towBase === null ? null : cents(row.towBase),
    towPerKm: row.towPerKm === null ? null : cents(row.towPerKm),
    towUnknownDistance: row.towUnknownDistance === null ? null : cents(row.towUnknownDistance),
    saleDiscountNoneBps: row.saleDiscountNoneBps === null ? null : bps(row.saleDiscountNoneBps),
    saleDiscountSmallBps: row.saleDiscountSmallBps === null ? null : bps(row.saleDiscountSmallBps),
    saleDiscountMediumBps: row.saleDiscountMediumBps === null ? null : bps(row.saleDiscountMediumBps),
    saleDiscountLargeBps: row.saleDiscountLargeBps === null ? null : bps(row.saleDiscountLargeBps),
  };
}

/**
 * Cria leilão (ou reaproveita leilão ativo de mesmo nome/leiloeiro), lote e rascunho v1 preenchido
 * em uma única transação para o `ownerId` informado.
 */
export async function importExternalLotForOwner(
  ownerId: string,
  input: ExternalLotCreateInput,
): Promise<Result<ImportedLotOutcome, ImportLotError>> {
  const [costOverrides, fipeLookup, estimateIndex] = await Promise.all([
    loadOwnerCostOverrides(ownerId),
    input.fipeValueCents === null
      ? lookupVehicleFipe({
          brand: input.brand,
          model: input.model,
          vehicleVersion: input.vehicleVersion,
          modelYear: input.modelYear,
          fuel: input.fuel,
          isMotorcycle: input.isMotorcycle,
        })
      : Promise.resolve(null),
    getRecentEstimateIndex(),
  ]);

  const fipeCents = input.fipeValueCents ?? fipeLookup?.value ?? null;
  const fipeRefMonth = input.fipeRefMonth ?? fipeLookup?.refMonth ?? null;
  const fipeSource =
    input.fipeValueCents !== null
      ? "Informada na importação"
      : fipeLookup
        ? fipeLookup.origin === "fipe_version"
          ? "Tabela FIPE (casada na importação)"
          : "Tabela FIPE (família aproximada)"
        : null;

  const assumptions = defaultAssumptions(
    {
      fipe: fipeCents,
      isMotorcycle: input.isMotorcycle,
      damageLevel: input.damageLevel,
      airbagDeployed: false,
      missingParts: false,
      dispatcherFee: null,
      removalFee: null,
      otherFees: input.otherFeesCents,
      commissionRate: input.commissionRateBps,
      distanceKm: null,
    },
    costOverrides,
  );

  const calcOutcome = calculateMaxBid({
    marketValue: assumptions.marketValue,
    repairCost: assumptions.repairCost,
    documentationCost: assumptions.documentationCost,
    transportCost: assumptions.transportCost,
    tiresCost: assumptions.tiresCost,
    serviceCost: assumptions.serviceCost,
    otherFees: assumptions.otherFees,
    debtsCost: assumptions.debtsCost,
    sellingCost: assumptions.sellingCost,
    taxCost: assumptions.taxCost,
    commissionMode: "percentage",
    commissionFixed: null,
    commissionRateBps: assumptions.commissionRateBps,
    riskReserve: null,
    riskReserveRateBps: assumptions.riskReserveRateBps,
    desiredMargin: null,
    desiredMarginRateBps: assumptions.desiredMarginRateBps,
  });

  const market = estimatePrice(
    {
      brand: input.brand,
      model: input.model,
      modelYear: input.modelYear,
      mileageKm: input.mileageKm,
      category: input.isMotorcycle ? "Motos" : "Carros",
      damageLevel: input.damageLevel,
      fipeCode: fipeLookup?.fipeCode ?? null,
      origin: null,
      marketValue: fipeCents,
    },
    estimateIndex,
  );

  const safeAuctionName = redactVehicleIds(input.auctionName);
  const safeVehicleVersion = input.vehicleVersion ? redactVehicleIds(input.vehicleVersion) : null;
  const safeNotes = input.notes ? redactVehicleIds(input.notes) : null;
  const draftNotesLines = [
    `Importado de ${input.auctioneer} (Importador Universal). Revise antes de fixar.`,
    fipeCents !== null ? `- FIPE: ${formatBRL(fipeCents)}${fipeSource ? ` (${fipeSource})` : ""}` : null,
    input.commissionRateBps !== null ? `- Comissão importada: ${formatBps(input.commissionRateBps)}` : null,
    input.otherFeesCents !== null ? `- Outras taxas importadas: ${formatBRL(input.otherFeesCents)}` : null,
  ].filter(Boolean);

  const now = new Date();
  const startsAt = input.startsAt ?? new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const marketReferenceDate = calendarDateToUtc(toZonedDateInput(now));

  try {
    const created = await db.$transaction(async (tx) => {
      const existingAuction = await tx.auction.findFirst({
        where: {
          ownerId,
          archivedAt: null,
          status: { in: ["scheduled", "in_progress"] },
          auctioneer: input.auctioneer,
          name: safeAuctionName,
        },
        orderBy: { startsAt: "desc" },
        select: { id: true },
      });

      const auctionId =
        existingAuction?.id ??
        (
          await tx.auction.create({
            data: {
              ownerId,
              name: safeAuctionName,
              auctioneer: input.auctioneer,
              origin: "other",
              status: "scheduled",
              startsAt,
              city: input.city,
              state: input.state,
            },
            select: { id: true },
          })
        ).id;

      const lot = await tx.lot.create({
        data: {
          ownerId,
          auctionId,
          lotNumber: input.lotNumber,
          brand: input.brand,
          model: input.model,
          vehicleVersion: safeVehicleVersion,
          manufactureYear: input.manufactureYear,
          modelYear: input.modelYear,
          mileageKm: input.mileageKm,
          currentBidCents: input.currentBidCents,
          currentBidObservedAt: input.currentBidCents === null ? null : now,
          lotUrl: input.lotUrl,
          isFollowed: true,
          notes: safeNotes,
        },
        select: { id: true },
      });

      const analysis = await tx.analysis.create({
        data: {
          ownerId,
          lotId: lot.id,
          version: 1,
          status: "draft",
          marketValueCents: assumptions.marketValue,
          marketReferenceDate: assumptions.marketValue === null ? null : marketReferenceDate,
          marketReferenceSource:
            assumptions.marketValue === null || assumptions.basis.saleDiscount === null
              ? null
              : `FIPE − ${formatBps(assumptions.basis.saleDiscount)} (importação)`,
          fipeValueCents: fipeCents,
          fipeReferenceMonth: fipeRefMonth,
          fipeReferenceSource: fipeSource,
          repairCostCents: assumptions.repairCost,
          documentationCostCents: assumptions.documentationCost,
          transportCostCents: assumptions.transportCost,
          tiresCostCents: assumptions.tiresCost,
          serviceCostCents: assumptions.serviceCost,
          otherFeesCents: assumptions.otherFees,
          debtsCostCents: assumptions.debtsCost,
          sellingCostCents: assumptions.sellingCost,
          taxCostCents: assumptions.taxCost,
          commissionMode: "percentage",
          commissionRateBps: assumptions.commissionRateBps,
          riskReserveBps: assumptions.riskReserveRateBps,
          desiredMarginBps: assumptions.desiredMarginRateBps,
          notes: draftNotesLines.join("\n"),
        },
        select: { id: true },
      });

      return { auctionId, lotId: lot.id, analysisId: analysis.id };
    });

    const marketBand =
      market.kind === "comparables" || market.kind === "market_ratio"
        ? {
            lowCents: market.low,
            medianCents: market.median,
            highCents: market.high,
            sampleSize: market.n,
            basis: market.kind,
          }
        : null;

    return ok({
      ...created,
      maxBidCents: calcOutcome.kind === "viable" ? calcOutcome.maxBid : null,
      isViable: calcOutcome.kind === "incomplete" ? null : calcOutcome.kind === "viable",
      fipeCents,
      marketBand,
    });
  } catch (error) {
    if (isUniqueViolation(error)) return err("duplicate_lot_number");
    throw error;
  }
}
