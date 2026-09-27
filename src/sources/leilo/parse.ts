import { z } from "zod";

import { splitBrandModel } from "@/domain/listings/place";
import type { ListingInput, ListingStatus } from "@/domain/listings/types";
import { bps } from "@/domain/money";
import { err, ok, type Result } from "@/lib/result";

import { extractAssignedJson, extractJsonLd, reaisToCents } from "../shared/extract";
import type { ParseError } from "../types";
import { type LeiloLot, leiloLotSchema, type LeiloVehicleLd, leiloVehicleLdSchema } from "./schema";

const BASE_URL = "https://leilo.com.br";
/** Fotos só do CDN do Leilo: é a origem liberada na CSP (`listingImageOrigins`, D-29). */
const PHOTO_ORIGIN = "https://leilo.cdndp.com.br/";

export const leiloListingUrl = (externalId: string) => `${BASE_URL}/lote/${externalId}/`;

/**
 * Situações do Leilo com significado confirmado em páginas reais. O que não estiver aqui não é adivinhado:
 * vira `open` antes do fim e `unknown` depois (docs/PLANO-COLETA.md §8).
 */
const STATUS_BY_SITUACAO: Record<string, ListingStatus> = {
  Criado: "open",
  EmLoteamento: "open",
  LiberadoLeilao: "open",
  Pago: "sold",
  Retirado: "withdrawn",
};

const pageStateSchema = z.object({ elastic: z.object({ lotePaginaAtualData: z.unknown() }) });

/** Página de lote do Leilo → anúncio no formato único. Estado da página primeiro, JSON-LD como reserva (D-27). */
export function parseLeiloListingPage(html: string, now: Date): Result<ListingInput, ParseError> {
  const state = pageStateSchema.safeParse(extractAssignedJson(html, "window.__INITIAL_STATE__"));
  const rawLot = state.success ? state.data.elastic.lotePaginaAtualData : null;
  const lot = rawLot === null ? null : leiloLotSchema.safeParse(rawLot);
  const ld = findVehicleLd(html);

  if (lot?.success) return ok(fromLot(lot.data, sanitizeRaw(rawLot), ld, now));
  if (ld) {
    const fallback = fromLd(ld, now);
    return fallback ? ok(fallback) : err("invalid_data");
  }
  return err(rawLot === null ? "missing_data" : "invalid_data");
}

function fromLot(lot: LeiloLot, raw: unknown, ld: LeiloVehicleLd | null, now: Date): ListingInput {
  const vehicle = lot.veiculo;
  const value = lot.valor;
  const split = splitBrandModel(lot.nome);
  const endsAt = toDate(lot.dataFim) ?? toDate(ld?.offers?.availabilityEnds);
  const address = ld?.offers?.availableAtOrFrom?.address;
  const bidCount = value?.lance?.quantidade ?? null;
  const bid = value?.lance?.valor;

  return {
    externalId: lot.id,
    url: leiloListingUrl(lot.id),
    lotNumber: lot.numero == null ? null : String(lot.numero),
    title: lot.nome,
    vehicle: {
      brand: vehicle?.infocarMarca ?? split.brand,
      model: vehicle?.infocarModelo ?? split.model,
      fipeCode: vehicle?.infocarFipeCodigo ?? null,
      fipeName: vehicle?.infocarFipeNome ?? null,
      modelYear: vehicle?.anoModelo ?? toYear(ld?.vehicleModelDate),
      manufactureYear: vehicle?.anoFabricacao ?? null,
      mileageKm: vehicle?.km ?? toInt(ld?.mileageFromOdometer?.value),
      // O estado abrevia ("Fle"); o JSON-LD traz o nome completo ("Flex").
      fuel: ld?.fuelType ?? vehicle?.combustivel ?? null,
      color: vehicle?.cor ?? ld?.color ?? null,
      category: lot.tipo ?? ld?.category ?? null,
      recoveryType: vehicle?.retomada ?? null,
      hasKey: vehicle?.possuiChave ?? null,
    },
    auction: {
      externalId: lot.leilao?.id ?? null,
      name: lot.leilao?.nome ?? null,
      startsAt: toDate(lot.leilao?.data),
    },
    sellerName: lot.comitente?.nome ?? null,
    startsAt: toDate(lot.dataInicio) ?? toDate(ld?.offers?.availabilityStarts),
    endsAt,
    location: {
      yardName: lot.localizacao?.nome ?? ld?.offers?.availableAtOrFrom?.name ?? null,
      city: lot.localizacao?.cidade ?? address?.addressLocality ?? null,
      state: normalizeState(lot.localizacao?.estado ?? address?.addressRegion),
      address: lot.localizacao?.endereco ?? address?.streetAddress ?? null,
    },
    status: mapStatus(lot.situacao ?? null, endsAt, now),
    sourceStatus: lot.situacao ?? null,
    currentBid: bid == null || bidCount === 0 ? null : reaisToCents(bid),
    minimumBid: value?.minimo == null ? null : reaisToCents(value.minimo),
    bidCount,
    marketValue: vehicle?.valorMercado ? reaisToCents(vehicle.valorMercado) : null,
    costs: {
      commissionRate: value?.comissaoPorcentagem == null ? null : bps(Math.round(value.comissaoPorcentagem * 100)),
      dispatcherFee: centsOrNull(value?.despachante),
      removalFee: centsOrNull(value?.remocao),
      storageFee: centsOrNull(value?.depositoDeBens),
      inspectionFee: centsOrNull(value?.vistoria),
      otherFees: centsOrNull(value?.outros),
    },
    photoUrls: fromPhotoOrigin(lot.fotosUrls ?? ld?.image ?? []),
    raw,
  };
}

/** Reserva: só o núcleo, quando o estado da página não existe mais ou mudou de forma. Sem id na URL: `null`. */
function fromLd(ld: LeiloVehicleLd, now: Date): ListingInput | null {
  const externalId = /\/lote\/([0-9a-f-]{36})/i.exec(ld.url)?.[1]?.toLowerCase();
  if (!externalId) return null;
  const split = splitBrandModel(ld.name);
  const offers = ld.offers;
  const address = offers?.availableAtOrFrom?.address;
  const endsAt = toDate(offers?.availabilityEnds);
  const availability = offers?.availability?.split("/").at(-1) ?? null;
  const status: ListingStatus = availability === "InStock" ? "open" : mapStatus(null, endsAt, now);

  return {
    externalId,
    url: leiloListingUrl(externalId),
    lotNumber: ld.sku == null ? null : String(ld.sku),
    title: ld.name,
    vehicle: {
      brand: ld.brand?.name ?? split.brand,
      model: ld.model ?? split.model,
      fipeCode: null,
      fipeName: null,
      modelYear: toYear(ld.vehicleModelDate),
      manufactureYear: null,
      mileageKm: toInt(ld.mileageFromOdometer?.value),
      fuel: ld.fuelType ?? null,
      color: ld.color ?? null,
      category: ld.category ?? null,
      recoveryType: null,
      hasKey: null,
    },
    auction: { externalId: null, name: null, startsAt: null },
    sellerName: null,
    startsAt: toDate(offers?.availabilityStarts),
    endsAt,
    location: {
      yardName: offers?.availableAtOrFrom?.name ?? null,
      city: address?.addressLocality ?? null,
      state: normalizeState(address?.addressRegion),
      address: address?.streetAddress ?? null,
    },
    status,
    sourceStatus: availability === null ? null : `ld:${availability}`,
    // Sem o estado da página não dá para separar lance dado de lance inicial: não registra lance.
    currentBid: null,
    minimumBid: null,
    bidCount: null,
    marketValue: null,
    costs: {
      commissionRate: null,
      dispatcherFee: null,
      removalFee: null,
      storageFee: null,
      inspectionFee: null,
      otherFees: null,
    },
    photoUrls: fromPhotoOrigin(ld.image ?? []),
    raw: ld,
  };
}

function mapStatus(situacao: string | null, endsAt: Date | null, now: Date): ListingStatus {
  const known = situacao === null ? undefined : STATUS_BY_SITUACAO[situacao];
  if (known) return known;
  return endsAt !== null && endsAt < now ? "unknown" : "open";
}

function findVehicleLd(html: string): LeiloVehicleLd | null {
  for (const block of extractJsonLd(html)) {
    const parsed = leiloVehicleLdSchema.safeParse(block);
    if (!parsed.success) continue;
    const types = [parsed.data["@type"]].flat();
    if (types.includes("Vehicle")) return parsed.data;
  }
  return null;
}

/** Guarda o lote original sem as fotos (vão para `photoUrls`) e sem quem deu lance. */
function sanitizeRaw(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const { fotosUrls: _photos, ...rest } = raw;
  const value = rest.valor;
  if (!isRecord(value) || !isRecord(value.lance)) return rest;
  const { apelido: _nickname, cidade: _city, ...lance } = value.lance;
  return { ...rest, valor: { ...value, lance } };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toDate = (value: string | null | undefined) => (value ? new Date(value) : null);
const toInt = (value: number | null | undefined) => (value == null ? null : Math.round(value));
const centsOrNull = (value: number | null | undefined) => (value == null ? null : reaisToCents(value));
const fromPhotoOrigin = (urls: readonly string[]) => urls.filter((url) => url.startsWith(PHOTO_ORIGIN));

function toYear(value: string | number | null | undefined): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
}

function normalizeState(value: string | null | undefined): string | null {
  const state = value?.trim().toUpperCase();
  return state && /^[A-Z]{2}$/.test(state) ? state : null;
}
