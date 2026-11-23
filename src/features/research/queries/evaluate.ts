import "server-only";

import { cacheLife } from "next/cache";
import { cache } from "react";
import { z } from "zod";

import { DAMAGE_LEVELS } from "@/domain/listings/condition";
import type { EstimateTarget } from "@/domain/listings/estimates";
import { VEHICLE_ORIGINS } from "@/domain/listings/origin";
import { cents } from "@/domain/money";
import { evaluate, type EvaluateFilters, inCut } from "@/domain/research/evaluate";
import { vehicleLabel } from "@/domain/research/filters";
import { isStateCode } from "@/domain/research/states";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { EvaluateOpenListing, EvaluateSaleView, EvaluationView, LotTarget, ResearchModelOption } from "../types";
import { loadFipeVersionLabels, MODEL_SUGGESTIONS_LIMIT, rows, salesSince, sql, VEHICLE_KEY } from "./sql";

/** Teto de vendas de um modelo no Avaliar: o maior modelo do catálogo tem perto de 2 mil no ano. */
const EVALUATE_SALES_LIMIT = 5000;

const evaluateSaleRow = z.object({
  vehicle_key: z.string(),
  id: z.string(),
  url: z.string(),
  title: z.string(),
  ends_at: z.date(),
  state: z.string().nullable(),
  city: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  model_year: z.number().int().nullable(),
  mileage_km: z.number().int().nullable(),
  category: z.string().nullable(),
  damage_level: z.enum(DAMAGE_LEVELS).nullable(),
  fipe_code: z.string().nullable(),
  vehicle_origin: z.enum(VEHICLE_ORIGINS),
  final_bid_cents: z.number().int(),
  market_value_cents: z.number().int().nullable(),
  source: z.string(),
  photo_url: z.string().nullable(),
});

export const keyOfVehicle = (vehicle: { brand: string; model: string }) => `${vehicle.brand}|${vehicle.model}`;

type KeyedSale = { vehicleKey: string; sale: EvaluateSaleView };

/**
 * Vendas dos modelos base (`keys`) encerradas em `[since, until)`, das mais recentes. Sem teto: quem chama corta a
 * janela e o limite de cada modelo.
 */
export async function loadModelSales(keys: readonly string[], since: Date, until: Date | null): Promise<KeyedSale[]> {
  if (keys.length === 0) return [];
  const found = await rows(
    evaluateSaleRow,
    sql`SELECT ${VEHICLE_KEY} AS vehicle_key, l.id::text AS id, l.url, l.title, l.ends_at, l.state::text AS state, l.city,
        l.brand, l.model, l.model_year::int AS model_year, l.mileage_km, l.category, l.damage_level::text AS damage_level,
        coalesce(l.fipe_code, l.market_value_fipe_code) AS fipe_code, l.vehicle_origin::text AS vehicle_origin,
        l.final_bid_cents, l.market_value_cents, s.name AS source, l.photo_urls[1] AS photo_url
      FROM listings l JOIN sources s ON s.id = l.source_id
      WHERE l.status = 'sold' AND l.final_bid_cents > 0 AND l.ends_at >= ${since}
        AND ${until === null ? sql`TRUE` : sql`l.ends_at < ${until}`}
        AND ${VEHICLE_KEY} IN (${Prisma.join(keys)})
      ORDER BY l.ends_at DESC, l.id`,
  );
  return found.map((row) => ({
    vehicleKey: row.vehicle_key,
    sale: {
      id: row.id,
      endsAt: row.ends_at,
      url: row.url,
      title: row.title,
      state: row.state !== null && isStateCode(row.state) ? row.state : null,
      city: row.city,
      brand: row.brand,
      model: row.model,
      modelYear: row.model_year,
      mileageKm: row.mileage_km,
      category: row.category,
      damageLevel: row.damage_level,
      fipeCode: row.fipe_code,
      origin: row.vehicle_origin,
      finalBid: cents(row.final_bid_cents),
      marketValue: row.market_value_cents !== null && row.market_value_cents > 0 ? cents(row.market_value_cents) : null,
      source: row.source,
      photoUrl: row.photo_url,
    },
  }));
}

/** As vendas de um modelo na janela das estimativas que termina em `until` (ou agora), até o teto do Avaliar. */
export function salesInWindow(sales: readonly KeyedSale[], key: string, until: Date | null): EvaluateSaleView[] {
  const since = salesSince(until);
  return sales
    .filter(
      (item) => item.vehicleKey === key && item.sale.endsAt >= since && (until === null || item.sale.endsAt < until),
    )
    .slice(0, EVALUATE_SALES_LIMIT)
    .map((item) => item.sale);
}

/**
 * Avaliar (D-71, docs/PLANO-MERCADO.md §5): as vendas do modelo base no último ano (o banco filtra o modelo, como a
 * Pesquisa) e o recorte, a faixa e as contagens calculados no domínio (`evaluate`), com o mesmo critério do preço
 * provável. Uma vez por requisição: a resposta, a lista e o gráfico usam o mesmo resultado.
 */
export const getEvaluation = cache(
  async (
    filters: EvaluateFilters,
    target: EstimateTarget | null,
    // Só vendas encerradas antes desta data (a Calibração recalcula a faixa da época sem vendas posteriores).
    until: Date | null = null,
  ): Promise<EvaluationView | null> => {
    await requireUser();
    if (filters.vehicle === null) return null;
    const key = keyOfVehicle(filters.vehicle);
    const sales = salesInWindow(await loadModelSales([key], salesSince(until), until), key, until);
    const evaluation = evaluate(sales, filters, target);
    const versionLabels = await loadFipeVersionLabels(evaluation.versions.map((option) => option.value));
    return {
      ...evaluation,
      modelSales: sales.length,
      versionLabels,
    };
  },
);

export const lotTargetSelect = {
  id: true,
  lotNumber: true,
  brand: true,
  model: true,
  modelYear: true,
  mileageKm: true,
  currentBidCents: true,
  analyses: {
    where: { maxBidCents: { not: null } },
    orderBy: { version: "desc" },
    take: 1,
    select: { maxBidCents: true },
  },
  listing: {
    select: {
      mileageKm: true,
      category: true,
      damageLevel: true,
      fipeCode: true,
      marketValueFipeCode: true,
      vehicleOrigin: true,
      marketValueCents: true,
      currentBidCents: true,
      status: true,
      endsAt: true,
    },
  },
} satisfies Prisma.LotSelect;

export function toLotTarget(lot: Prisma.LotGetPayload<{ select: typeof lotTargetSelect }>): LotTarget {
  const { listing } = lot;
  const currentBidCents = lot.currentBidCents ?? listing?.currentBidCents ?? null;
  const maxBidCents = lot.analyses[0]?.maxBidCents ?? null;
  return {
    id: lot.id,
    label: `Lote ${lot.lotNumber} · ${lot.brand} ${lot.model} ${lot.modelYear}`,
    endsAt: listing?.status === "open" ? listing.endsAt : null,
    currentBid: currentBidCents !== null && currentBidCents > 0 ? cents(currentBidCents) : null,
    maxBid: maxBidCents !== null && maxBidCents > 0 ? cents(maxBidCents) : null,
    target: {
      brand: lot.brand,
      model: lot.model,
      modelYear: lot.modelYear,
      mileageKm: lot.mileageKm ?? listing?.mileageKm ?? null,
      category: listing?.category ?? null,
      damageLevel: listing?.damageLevel ?? null,
      fipeCode: listing === null ? null : (listing.fipeCode ?? listing.marketValueFipeCode),
      origin: listing?.vehicleOrigin ?? null,
      marketValue:
        listing?.marketValueCents === null || listing?.marketValueCents === undefined
          ? null
          : cents(listing.marketValueCents),
    },
  };
}

/**
 * Lote do usuário como alvo do Avaliar: veículo do lote e, com anúncio ligado, categoria, condição, versão FIPE,
 * origem e valor de mercado. Lote de outro dono é `null`.
 */
export const getLotTarget = cache(async (lotId: string): Promise<LotTarget | null> => {
  const user = await requireUser();
  const lot = await db.lot.findFirst({ where: { id: lotId, ownerId: user.id }, select: lotTargetSelect });
  return lot === null ? null : toLotTarget(lot);
});

/** Teto de lotes abertos de um modelo no Avaliar. */
const OPEN_LISTINGS_LIMIT = 200;

const openListingRow = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  ends_at: z.date().nullable(),
  state: z.string().nullable(),
  city: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  model_year: z.number().int().nullable(),
  mileage_km: z.number().int().nullable(),
  category: z.string().nullable(),
  damage_level: z.enum(DAMAGE_LEVELS).nullable(),
  fipe_code: z.string().nullable(),
  vehicle_origin: z.enum(VEHICLE_ORIGINS),
  current_bid_cents: z.number().int().nullable(),
  source: z.string(),
  photo_url: z.string().nullable(),
});

/**
 * Lotes abertos do recorte do Avaliar (mesmo modelo base no banco, o resto do recorte no domínio com `inCut`), do que
 * encerra primeiro ao último, com o lote do usuário quando o anúncio já foi analisado.
 */
export const getOpenListingsFor = cache(async (filters: EvaluateFilters): Promise<EvaluateOpenListing[]> => {
  const user = await requireUser();
  if (filters.vehicle === null) return [];
  const found = await rows(
    openListingRow,
    sql`SELECT l.id::text AS id, l.url, l.title, l.ends_at, l.state::text AS state, l.city, l.brand, l.model,
        l.model_year::int AS model_year, l.mileage_km, l.category, l.damage_level::text AS damage_level,
        coalesce(l.fipe_code, l.market_value_fipe_code) AS fipe_code, l.vehicle_origin::text AS vehicle_origin,
        l.current_bid_cents, s.name AS source, l.photo_urls[1] AS photo_url
      FROM listings l JOIN sources s ON s.id = l.source_id
      WHERE l.status = 'open' AND (l.ends_at IS NULL OR l.ends_at > now())
        AND ${VEHICLE_KEY} = ${`${filters.vehicle.brand}|${filters.vehicle.model}`}
      ORDER BY l.ends_at ASC NULLS LAST, l.id LIMIT ${OPEN_LISTINGS_LIMIT}`,
  );
  const inRecort = found.filter((row) =>
    inCut(
      {
        brand: row.brand,
        model: row.model,
        modelYear: row.model_year,
        mileageKm: row.mileage_km,
        category: row.category,
        damageLevel: row.damage_level,
        fipeCode: row.fipe_code,
        origin: row.vehicle_origin,
      },
      filters,
    ),
  );
  const lots =
    inRecort.length === 0
      ? []
      : await db.lot.findMany({
          where: { ownerId: user.id, listingId: { in: inRecort.map((row) => row.id) } },
          select: { id: true, listingId: true },
        });
  const lotOf = new Map(lots.map((lot) => [lot.listingId, lot.id]));
  return inRecort.map((row) => ({
    id: row.id,
    url: row.url,
    title: row.title,
    modelYear: row.model_year,
    mileageKm: row.mileage_km,
    endsAt: row.ends_at,
    currentBid: row.current_bid_cents === null ? null : cents(row.current_bid_cents),
    state: row.state !== null && isStateCode(row.state) ? row.state : null,
    city: row.city,
    source: row.source,
    photoUrl: row.photo_url,
    trackedLotId: lotOf.get(row.id) ?? null,
    trackable: row.brand !== null && row.model !== null && row.model_year !== null,
  }));
});

/** Modelos com venda no último ano, de qualquer categoria e condição, para a busca do Avaliar. */
export async function getEvaluateModels(): Promise<ResearchModelOption[]> {
  await requireUser();
  return loadEvaluateModels();
}

/** Igual para todos os usuários: cache do catálogo (D-78). */
async function loadEvaluateModels(): Promise<ResearchModelOption[]> {
  "use cache";
  cacheLife("catalog");
  const models = await rows(
    z.object({ key: z.string(), n: z.number().int() }),
    sql`SELECT t.key, count(*)::int AS n
      FROM (SELECT ${VEHICLE_KEY} AS key FROM listings l
        WHERE l.status = 'sold' AND l.final_bid_cents > 0 AND l.ends_at >= ${salesSince()}) t
      WHERE t.key IS NOT NULL GROUP BY t.key ORDER BY 2 DESC, 1 LIMIT ${MODEL_SUGGESTIONS_LIMIT}`,
  );
  return models.flatMap(({ key, n }) => {
    const [brand = "", model = ""] = key.split("|");
    return brand && model ? [{ brand, model, label: vehicleLabel({ brand, model }), sales: n }] : [];
  });
}

/** Quantos lotes o Avaliar oferece como atalho sem veículo escolhido. */
const LOT_SHORTCUTS = 6;

/**
 * Atalhos da entrada do Avaliar: os lotes do usuário que ainda não foram arquivados, os acompanhados primeiro e depois
 * os mexidos por último. Cada um abre o Avaliar com o lote como alvo.
 */
export async function getEvaluateLotShortcuts(): Promise<{ id: string; label: string }[]> {
  const user = await requireUser();
  const lots = await db.lot.findMany({
    where: { ownerId: user.id, archivedAt: null },
    orderBy: [{ isFollowed: "desc" }, { updatedAt: "desc" }],
    take: LOT_SHORTCUTS,
    select: { id: true, lotNumber: true, brand: true, model: true, modelYear: true },
  });
  return lots.map((lot) => ({
    id: lot.id,
    label: `${lot.brand} ${lot.model} ${lot.modelYear} · lote ${lot.lotNumber}`,
  }));
}
