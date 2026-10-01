import type { Cents } from "../money";
import type { ListingStatus } from "./types";

/**
 * "Adicionar à análise" (docs/PLANO-COLETA.md, etapa 3): do anúncio coletado para leilão, lote e rascunho do
 * Tracker. Só copia o que a fonte informa; as premissas do rascunho são as padrão (D-38), montadas pela feature.
 */

/** Limites dos formulários de lote (src/features/lots/schemas.ts): o lote criado precisa poder ser editado. */
const MAX_LOT_NUMBER = 30;
const MAX_BRAND = 80;
const MAX_MODEL = 80;
const MAX_VERSION = 120;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export type TrackerListing = {
  sourceId: string;
  sourceName: string;
  externalId: string;
  url: string;
  lotNumber: string | null;
  brand: string | null;
  model: string | null;
  fipeName: string | null;
  modelYear: number | null;
  manufactureYear: number | null;
  mileageKm: number | null;
  recoveryType: string | null;
  auctionExternalId: string | null;
  auctionName: string | null;
  auctionStartsAt: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
  status: ListingStatus;
  currentBid: Cents | null;
  minimumBid: Cents | null;
  lastCheckedAt: Date;
};

/** Mesmos valores dos enums do banco (`auction_origin`, `auction_status`). */
export type TrackerAuctionOrigin = "financial" | "insurer" | "other" | "unknown";
export type TrackerAuctionStatus = "scheduled" | "in_progress" | "finished";

export type TrackerAuction = {
  sourceId: string;
  externalId: string;
  name: string;
  auctioneer: string;
  origin: TrackerAuctionOrigin;
  status: TrackerAuctionStatus;
  startsAt: Date;
};

export type TrackerLot = {
  lotNumber: string;
  brand: string;
  model: string;
  vehicleVersion: string | null;
  modelYear: number;
  manufactureYear: number | null;
  mileageKm: number | null;
  startingBid: Cents | null;
  currentBid: Cents | null;
  currentBidObservedAt: Date | null;
  lotUrl: string;
};

export type TrackerPlan = { auction: TrackerAuction; lot: TrackerLot };

/** O que falta no anúncio para virar lote (ex.: imóvel, equipamento ou veículo sem ano). */
export type TrackerMissing = "brand" | "model" | "model_year" | "auction";

export type TrackerPlanResult = { ok: true; value: TrackerPlan } | { ok: false; missing: TrackerMissing[] };

/** Campos que decidem se o anúncio pode virar lote (`trackerMissing`); o cartão lê só estes. */
export type TrackerRequirements = Pick<
  TrackerListing,
  "brand" | "model" | "modelYear" | "auctionExternalId" | "auctionName" | "auctionStartsAt" | "startsAt" | "endsAt"
>;

function requiredFields(listing: TrackerRequirements) {
  return {
    brand: clip(listing.brand, MAX_BRAND),
    model: clip(listing.model, MAX_MODEL),
    modelYear: validYear(listing.modelYear),
    auctionExternalId: clip(listing.auctionExternalId, Number.POSITIVE_INFINITY),
    auctionName: clip(listing.auctionName, Number.POSITIVE_INFINITY),
    auctionStartsAt: listing.auctionStartsAt ?? listing.startsAt ?? listing.endsAt,
  };
}

/** O que falta para o anúncio virar lote. Vazio: pode (o cartão mostra "Adicionar à análise"). */
export function trackerMissing(listing: TrackerRequirements): TrackerMissing[] {
  const fields = requiredFields(listing);
  const missing: TrackerMissing[] = [];
  if (fields.brand === null) missing.push("brand");
  if (fields.model === null) missing.push("model");
  if (fields.modelYear === null) missing.push("model_year");
  if (fields.auctionExternalId === null || fields.auctionName === null || fields.auctionStartsAt === null) {
    missing.push("auction");
  }
  return missing;
}

export function planTracker(listing: TrackerListing, now: Date): TrackerPlanResult {
  const { brand, model, modelYear, auctionExternalId, auctionName, auctionStartsAt } = requiredFields(listing);
  if (
    brand === null ||
    model === null ||
    modelYear === null ||
    auctionExternalId === null ||
    auctionName === null ||
    auctionStartsAt === null
  ) {
    return { ok: false, missing: trackerMissing(listing) };
  }

  const manufactureYear = validYear(listing.manufactureYear);
  return {
    ok: true,
    value: {
      auction: {
        sourceId: listing.sourceId,
        externalId: auctionExternalId,
        name: auctionName,
        auctioneer: listing.sourceName,
        origin: auctionOrigin(listing.recoveryType),
        status: auctionStatus(listing, auctionStartsAt, now),
        startsAt: auctionStartsAt,
      },
      lot: {
        lotNumber: clip(listing.lotNumber, MAX_LOT_NUMBER) ?? listing.externalId.slice(0, MAX_LOT_NUMBER),
        brand,
        model,
        vehicleVersion: clip(listing.fipeName, MAX_VERSION),
        modelYear,
        // O banco exige fabricação ≤ ano-modelo; fora disso a fonte errou e o campo fica vazio.
        manufactureYear: manufactureYear !== null && manufactureYear <= modelYear ? manufactureYear : null,
        mileageKm: listing.mileageKm !== null && listing.mileageKm >= 0 ? listing.mileageKm : null,
        startingBid: positive(listing.minimumBid),
        currentBid: positive(listing.currentBid),
        currentBidObservedAt: positive(listing.currentBid) === null ? null : listing.lastCheckedAt,
        lotUrl: listing.url,
      },
    },
  };
}

/** Tipo de retomada da fonte → origem do leilão. Sem correspondência clara: desconhecida (nunca adivinhada). */
export function auctionOrigin(recoveryType: string | null): TrackerAuctionOrigin {
  const text = recoveryType?.toLocaleLowerCase("pt-BR") ?? "";
  if (text.includes("financ")) return "financial";
  if (text.includes("segur")) return "insurer";
  if (text.includes("frota") || text.includes("leiloshop")) return "other";
  return "unknown";
}

function auctionStatus(listing: TrackerListing, startsAt: Date, now: Date): TrackerAuctionStatus {
  if (listing.status !== "open" || (listing.endsAt !== null && listing.endsAt <= now)) return "finished";
  return startsAt <= now ? "in_progress" : "scheduled";
}

function clip(value: string | null, max: number): string | null {
  const text = value?.trim() ?? "";
  return text === "" ? null : text.slice(0, max).trim();
}

function validYear(year: number | null): number | null {
  return year !== null && Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR ? year : null;
}

function positive(value: Cents | null): Cents | null {
  return value !== null && value > 0 ? value : null;
}

/**
 * O lance do anúncio vale para o lote quando é mais novo que o do lote e diferente dele. Lance digitado depois da
 * última leitura do coletor fica até a próxima leitura.
 */
export function shouldSyncBid(
  lot: { currentBid: Cents | null; currentBidObservedAt: Date | null },
  listing: { currentBid: Cents | null; lastCheckedAt: Date },
): boolean {
  if (listing.currentBid === null || listing.currentBid <= 0 || listing.currentBid === lot.currentBid) return false;
  return lot.currentBidObservedAt === null || listing.lastCheckedAt > lot.currentBidObservedAt;
}
