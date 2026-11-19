import "server-only";

import { finalBidOf, goneStatus, observationChanged } from "@/domain/listings/collect";
import { marketValueOnSave } from "@/domain/listings/fipe-match";
import { type Coordinates, distanceKm } from "@/domain/listings/geo";
import { inferOrigin } from "@/domain/listings/origin";
import { municipalityKey } from "@/domain/listings/place";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { nextCheckAt, retryAfterFailure, TRACKED_REFRESH_MS } from "@/domain/listings/schedule";
import type { ListingInput } from "@/domain/listings/types";
import { vehicleKey } from "@/domain/listings/vehicle-key";
import type { Prisma } from "@/generated/prisma/client";

import { db } from "../db";
import { changedFields } from "./changes";

/**
 * Gravação do catálogo global (D-25). Roda sem usuário (D-26): só o coletor chama estas funções,
 * e elas só gravam nas tabelas do catálogo (`findTrackedVisits` também lê `lots`).
 */

/** A transação faz até três idas ao banco; com latência alta (ex.: máquina local → EUA) o padrão de 5 s não basta. */
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

type Place = Coordinates & { ibgeCode: number };
export type PlaceLookup = (city: string | null, state: string | null) => Place | null;

/** Municípios em memória (≈ 5,6 mil linhas), para casar a cidade da fonte com o IBGE sem uma consulta por anúncio. */
export async function loadPlaceLookup(): Promise<PlaceLookup> {
  const rows = await db.municipality.findMany({
    select: { ibgeCode: true, nameKey: true, state: true, latitude: true, longitude: true },
  });
  const byKey = new Map(rows.map((row) => [municipalityKey(row.nameKey, row.state), row]));
  return (city, state) => {
    if (!city || !state) return null;
    const row = byKey.get(municipalityKey(city, state));
    return row ? { ibgeCode: row.ibgeCode, latitude: row.latitude, longitude: row.longitude } : null;
  };
}

/** Tamanho dos lotes para consultas `IN (...)` e atualizações em massa no coletor. */
const ID_CHUNK = 500;

export async function hasOpenListings(sourceId: string): Promise<boolean> {
  const row = await db.listing.findFirst({ where: { sourceId, status: "open" }, select: { id: true } });
  return row !== null;
}

export async function findKnownIds(sourceId: string, externalIds: readonly string[]): Promise<Set<string>> {
  const known = new Set<string>();
  for (let start = 0; start < externalIds.length; start += ID_CHUNK) {
    const chunk = externalIds.slice(start, start + ID_CHUNK);
    const rows = await db.listing.findMany({
      where: { sourceId, externalId: { in: chunk } },
      select: { externalId: true },
    });
    for (const row of rows) known.add(row.externalId);
  }
  return known;
}

/** Dado bruto da última leitura (`listings.raw`), para a fonte que precisa dele na revisita (D-48). */
export async function findStoredRaw(sourceId: string, externalId: string): Promise<unknown> {
  const row = await db.listing.findUnique({
    where: { sourceId_externalId: { sourceId, externalId } },
    select: { raw: true },
  });
  return row?.raw ?? null;
}

/** Anúncios ainda no sitemap: atualiza "visto por último" em lotes ordenados para evitar locks longos. */
export async function markSeen(sourceId: string, externalIds: readonly string[], now: Date): Promise<void> {
  if (externalIds.length === 0) return;
  const sorted = [...externalIds].sort();
  for (let start = 0; start < sorted.length; start += ID_CHUNK) {
    await db.listing.updateMany({
      where: { sourceId, externalId: { in: sorted.slice(start, start + ID_CHUNK) } },
      data: { lastSeenAt: now },
    });
  }
}

/** Revisitas vencidas, da mais antiga para a mais nova. */
export async function findDueVisits(sourceId: string, now: Date, limit: number) {
  return db.listing.findMany({
    where: { sourceId, nextCheckAt: { lte: now } },
    orderBy: { nextCheckAt: "asc" },
    take: limit,
    select: { externalId: true, url: true },
  });
}

/**
 * Anúncios abertos ligados a lotes ativos de algum usuário e lidos há mais de TRACKED_REFRESH_MS: entram antes das
 * revisitas comuns, para o lance do lote acompanhar a fonte (etapa 3). Só lê `lots` (D-34).
 */
export async function findTrackedVisits(sourceId: string, now: Date, limit: number) {
  return db.listing.findMany({
    where: {
      sourceId,
      status: "open",
      nextCheckAt: { not: null },
      lastCheckedAt: { lte: new Date(now.getTime() - TRACKED_REFRESH_MS) },
      lots: { some: { archivedAt: null } },
    },
    orderBy: { lastCheckedAt: "asc" },
    take: limit,
    select: { externalId: true, url: true },
  });
}

/** O anúncio gravado, para comparar com a leitura nova: toda coluna que `saveListing` grava, menos as da visita. */
const storedListingSelect = {
  id: true,
  url: true,
  lotNumber: true,
  title: true,
  brand: true,
  model: true,
  fipeCode: true,
  fipeName: true,
  modelYear: true,
  manufactureYear: true,
  mileageKm: true,
  fuel: true,
  color: true,
  category: true,
  recoveryType: true,
  hasKey: true,
  sellerName: true,
  vehicleOrigin: true,
  vehicleKey: true,
  description: true,
  damageLevel: true,
  conditionFlags: true,
  inspectionResult: true,
  inspectionNotes: true,
  auctionExternalId: true,
  auctionName: true,
  auctionStartsAt: true,
  startsAt: true,
  endsAt: true,
  yardName: true,
  city: true,
  state: true,
  address: true,
  municipalityId: true,
  status: true,
  sourceStatus: true,
  currentBidCents: true,
  minimumBidCents: true,
  bidCount: true,
  finalBidCents: true,
  commissionBps: true,
  dispatcherFeeCents: true,
  removalFeeCents: true,
  storageFeeCents: true,
  inspectionFeeCents: true,
  otherFeesCents: true,
  photoUrls: true,
  raw: true,
  marketValueCents: true,
  marketValueOrigin: true,
  marketValueFipeCode: true,
  marketValueRefMonth: true,
  marketValueCheckedAt: true,
  fipeMatchId: true,
} satisfies Prisma.ListingSelect;

/**
 * Cria ou atualiza o anúncio (único por fonte + id na fonte) e grava uma observação quando lance
 * ou situação mudam. Tudo numa transação: anúncio e histórico nunca divergem.
 */
export async function saveListing(
  sourceId: string,
  input: ListingInput,
  context: { now: Date; place: PlaceLookup },
): Promise<"created" | "updated"> {
  const { now } = context;
  const place = context.place(input.location.city, input.location.state);
  const inRegion = place !== null && distanceKm(DEFAULT_REGION.center, place) <= DEFAULT_REGION.radiusKm;
  const fields = {
    url: input.url,
    lotNumber: input.lotNumber,
    title: input.title,
    brand: input.vehicle.brand,
    model: input.vehicle.model,
    fipeCode: input.vehicle.fipeCode,
    fipeName: input.vehicle.fipeName,
    modelYear: input.vehicle.modelYear,
    manufactureYear: input.vehicle.manufactureYear,
    mileageKm: input.vehicle.mileageKm,
    fuel: input.vehicle.fuel,
    color: input.vehicle.color,
    category: input.vehicle.category,
    recoveryType: input.vehicle.recoveryType,
    hasKey: input.vehicle.hasKey,
    sellerName: input.sellerName,
    vehicleOrigin: inferOrigin({
      recoveryType: input.vehicle.recoveryType,
      sellerName: input.sellerName,
      sourceId,
    }),
    vehicleKey: vehicleKey(input.vehicle.brand, input.vehicle.model),
    description: input.description,
    damageLevel: input.condition.damageLevel,
    conditionFlags: input.condition.flags,
    inspectionResult: input.condition.inspection,
    inspectionNotes: input.condition.inspectionNotes,
    auctionExternalId: input.auction.externalId,
    auctionName: input.auction.name,
    auctionStartsAt: input.auction.startsAt,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    yardName: input.location.yardName,
    city: input.location.city,
    state: input.location.state,
    address: input.location.address,
    municipalityId: place?.ibgeCode ?? null,
    status: input.status,
    sourceStatus: input.sourceStatus,
    currentBidCents: input.currentBid,
    minimumBidCents: input.minimumBid,
    bidCount: input.bidCount,
    finalBidCents: finalBidOf(input),
    commissionBps: input.costs.commissionRate,
    dispatcherFeeCents: input.costs.dispatcherFee,
    removalFeeCents: input.costs.removalFee,
    storageFeeCents: input.costs.storageFee,
    inspectionFeeCents: input.costs.inspectionFee,
    otherFeesCents: input.costs.otherFees,
    photoUrls: input.photoUrls,
    raw: toJson(input.raw),
  } satisfies Prisma.ListingUncheckedUpdateInput;
  // Mudam a cada visita: sempre gravadas.
  const visit = {
    lastCheckedAt: now,
    nextCheckAt: nextCheckAt({
      status: input.status,
      endsAt: input.endsAt,
      inRegion,
      hasPhotos: input.photoUrls.length > 0,
      now,
    }),
    checkFailures: 0,
  } satisfies Prisma.ListingUncheckedUpdateInput;

  return db.$transaction(async (tx) => {
    const previous = await tx.listing.findUnique({
      where: { sourceId_externalId: { sourceId, externalId: input.externalId } },
      select: storedListingSelect,
    });
    const marketValue = marketValueFields(
      marketValueOnSave(previous && { ...previous, origin: previous.marketValueOrigin }, {
        ...input.vehicle,
        marketValue: input.marketValue,
      }),
    );
    const listing = previous
      ? await tx.listing.update({
          where: { id: previous.id },
          // Só o que mudou (D-81): a maioria das revisitas não muda lance nem situação.
          data: { ...changedFields(previous, { ...fields, ...marketValue }), ...visit },
          select: { id: true },
        })
      : await tx.listing.upsert({
          where: { sourceId_externalId: { sourceId, externalId: input.externalId } },
          create: {
            ...fields,
            ...marketValue,
            ...visit,
            sourceId,
            externalId: input.externalId,
            firstSeenAt: now,
            lastSeenAt: now,
          },
          update: { ...fields, ...marketValue, ...visit },
          select: { id: true },
        });
    const next = { status: input.status, bidCents: input.currentBid, bidCount: input.bidCount };
    const before = previous && {
      status: previous.status,
      bidCents: previous.currentBidCents,
      bidCount: previous.bidCount,
    };
    if (observationChanged(before, next)) {
      await tx.listingObservation.create({ data: { listingId: listing.id, observedAt: now, ...next } });
    }
    return previous ? "updated" : "created";
  }, TRANSACTION_OPTIONS);
}

/** Colunas do valor de mercado para cada decisão de `marketValueOnSave` (D-47); `keep` não mexe em nenhuma. */
function marketValueFields(
  decision: ReturnType<typeof marketValueOnSave>,
): Pick<
  Prisma.ListingUncheckedCreateInput,
  | "marketValueCents"
  | "marketValueOrigin"
  | "marketValueFipeCode"
  | "marketValueRefMonth"
  | "marketValueCheckedAt"
  | "fipeMatchId"
> {
  if (decision.kind === "keep") return {};
  const source = decision.kind === "source";
  return {
    marketValueCents: source ? decision.value : null,
    marketValueOrigin: source ? "source" : null,
    marketValueFipeCode: null,
    marketValueRefMonth: null,
    marketValueCheckedAt: null,
    // A correlação (D-49) vale para o veículo antigo; o novo procura a dele no próximo casamento.
    fipeMatchId: null,
  };
}

/**
 * Página do anúncio fora do ar (HTTP 404). Encerrado ou fora do sitemap: grava a situação de `goneStatus` e para de
 * revisitar (devolve `true`). Senão, ou se o anúncio não existe: `false`, e o 404 conta como falha comum.
 */
export async function markGone(
  sourceId: string,
  externalId: string,
  now: Date,
  sitemapReadAt: Date | null,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({
      where: { sourceId_externalId: { sourceId, externalId } },
      select: { id: true, status: true, endsAt: true, lastSeenAt: true, currentBidCents: true, bidCount: true },
    });
    const status = listing && goneStatus(listing, now, sitemapReadAt);
    if (!listing || !status) return false;
    await tx.listing.update({
      where: { id: listing.id },
      data: { status, lastCheckedAt: now, nextCheckAt: null, checkFailures: 0 },
    });
    if (status !== listing.status) {
      await tx.listingObservation.create({
        data: {
          listingId: listing.id,
          observedAt: now,
          status,
          bidCents: listing.currentBidCents,
          bidCount: listing.bidCount,
        },
      });
    }
    return true;
  }, TRANSACTION_OPTIONS);
}

/** Falha ao revisitar um anúncio conhecido: espera crescente e, no limite, desiste (`nextCheckAt` nulo). */
export async function recordCheckFailure(sourceId: string, externalId: string, now: Date): Promise<void> {
  const listing = await db.listing.findUnique({
    where: { sourceId_externalId: { sourceId, externalId } },
    select: { checkFailures: true },
  });
  if (!listing) return;
  const failures = listing.checkFailures + 1;
  await db.listing.update({
    where: { sourceId_externalId: { sourceId, externalId } },
    data: { checkFailures: failures, lastCheckedAt: now, nextCheckAt: retryAfterFailure(failures, now) },
  });
}

/** JSON serializável para a coluna `raw` (datas viram texto, `undefined` some). Os adaptadores entregam objetos. */
function toJson(value: unknown): Prisma.InputJsonValue {
  const parsed: unknown = JSON.parse(JSON.stringify(value ?? {}));
  return isJsonObjectOrArray(parsed) ? parsed : {};
}

function isJsonObjectOrArray(value: unknown): value is Prisma.InputJsonObject | Prisma.InputJsonArray {
  return typeof value === "object" && value !== null;
}
