import "server-only";

import { cache } from "react";

import type { UserDefaultOverrides } from "@/domain/finance/defaults";
import { normalizePlaceName, stateCode } from "@/domain/listings/place";
import { resolveRegion } from "@/domain/listings/region";
import { bps, cents } from "@/domain/money";
import { requireUser } from "@/server/auth";
import { type CatalogMunicipality, loadAllMunicipalities } from "@/server/catalog-values";
import { db } from "@/server/db";

import type { MunicipalityOption, RawUserPreferences, UserPreferences } from "./types";

const EMPTY_RAW: RawUserPreferences = {
  municipalityIbgeCode: null,
  municipalityLabel: null,
  radiusKm: null,
  desiredMarginRateBps: null,
  riskReserveRateBps: null,
  documentationCost: null,
  towBase: null,
  towPerKm: null,
  towUnknownDistance: null,
  saleDiscountNoneBps: null,
  saleDiscountSmallBps: null,
  saleDiscountMediumBps: null,
  saleDiscountLargeBps: null,
  updatedAt: null,
};

/**
 * Preferências persistidas do usuário autenticado, memorizadas por requisição (`React.cache`).
 * Qualquer campo ausente cai com segurança para `DEFAULT_REGION` e `DEFAULT_COSTS` / `SALE_DISCOUNT_BPS`.
 */
export const getUserPreferences = cache(async (): Promise<UserPreferences> => {
  const user = await requireUser();
  const row = await db.userPreference.findUnique({
    where: { ownerId: user.id },
    select: {
      municipalityIbgeCode: true,
      radiusKm: true,
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
      updatedAt: true,
      municipality: {
        select: {
          ibgeCode: true,
          name: true,
          state: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  if (!row) {
    return {
      region: resolveRegion(null),
      costOverrides: {},
      raw: EMPTY_RAW,
      hasOverrides: false,
    };
  }

  const raw: RawUserPreferences = {
    municipalityIbgeCode: row.municipality?.ibgeCode ?? null,
    municipalityLabel: row.municipality ? `${row.municipality.name}/${row.municipality.state}` : null,
    radiusKm: row.radiusKm,
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
    updatedAt: row.updatedAt,
  };

  const costOverrides: UserDefaultOverrides = {
    desiredMarginRateBps: raw.desiredMarginRateBps,
    riskReserveRateBps: raw.riskReserveRateBps,
    documentationCost: raw.documentationCost,
    towBase: raw.towBase,
    towPerKm: raw.towPerKm,
    towUnknownDistance: raw.towUnknownDistance,
    saleDiscountNoneBps: raw.saleDiscountNoneBps,
    saleDiscountSmallBps: raw.saleDiscountSmallBps,
    saleDiscountMediumBps: raw.saleDiscountMediumBps,
    saleDiscountLargeBps: raw.saleDiscountLargeBps,
  };

  const hasOverrides =
    raw.municipalityIbgeCode !== null ||
    raw.radiusKm !== null ||
    raw.desiredMarginRateBps !== null ||
    raw.riskReserveRateBps !== null ||
    raw.documentationCost !== null ||
    raw.towBase !== null ||
    raw.towPerKm !== null ||
    raw.towUnknownDistance !== null ||
    raw.saleDiscountNoneBps !== null ||
    raw.saleDiscountSmallBps !== null ||
    raw.saleDiscountMediumBps !== null ||
    raw.saleDiscountLargeBps !== null;

  return {
    region: resolveRegion({ municipality: row.municipality, radiusKm: row.radiusKm }),
    costOverrides,
    raw,
    hasOverrides,
  };
});

/** Busca municípios IBGE por nome (sem acento) e opcionalmente UF (ex.: "Campinas/SP" ou "Campinas"). */
export async function searchMunicipalities(query: string): Promise<MunicipalityOption[]> {
  await requireUser();

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const [rawName, rawState] = trimmed.split(/[/,-]/).map((part) => part.trim());
  const parsedState = rawState ? stateCode(rawState) : null;
  const nameKey = normalizePlaceName(rawName ?? trimmed);
  if (nameKey.length < 2) return [];

  const all = await loadAllMunicipalities();
  const starts: CatalogMunicipality[] = [];
  const contains: CatalogMunicipality[] = [];

  // Prioriza quem começa com o termo buscado antes de aplicar o limite de 20 itens.
  for (const row of all) {
    if (parsedState && row.state !== parsedState) continue;
    if (row.nameKey.startsWith(nameKey)) starts.push(row);
    else if (row.nameKey.includes(nameKey)) contains.push(row);
  }

  return [...starts, ...contains].slice(0, 20).map((row) => ({
    ibgeCode: row.ibgeCode,
    name: row.name,
    state: row.state,
    label: `${row.name}/${row.state}`,
  }));
}
