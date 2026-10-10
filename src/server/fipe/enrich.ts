import "server-only";

import {
  chooseFipeModels,
  fipeFuelCodes,
  type FipeMatch,
  type FipeModelChoice,
  type FipeOption,
  fipeReferenceMonth,
  type FipeTable,
  type FipeValue,
  type FipeVehicleType,
  fipeVehicleTypes,
  matchFipeBrand,
  pickFipeTable,
  settleFipeValue,
} from "@/domain/listings/fipe-match";
import { type ListingStatus, toListingCategory } from "@/domain/listings/types";

import { db } from "../db";
import { FipeBudgetError, type FipeClient, FipeUnavailableError } from "./client";

/**
 * Casa na tabela FIPE oficial o valor de mercado dos anúncios sem valor da fonte (D-47; docs/PLANO-VALOR-MERCADO.md
 * §3 e §4). Roda junto com a coleta, com o tempo dela, e pelo `npm run db:market-values` para o acervo. Cada
 * anúncio é tentado uma vez (`market_value_checked_at`); volta a ser tentado se o veículo mudar.
 */

const VEHICLE_CATEGORIES = ["Carros", "Utilitarios", "Motos", "Pesados"];
const BATCH = 50;

export type MatchReason =
  "matched" | "no_type" | "no_brand" | Extract<FipeModelChoice, { kind: "none" }>["reason"] | "spread" | "no_value";

export type MatchSample = {
  listingId: string;
  title: string;
  reason: MatchReason;
  match: FipeMatch | null;
  /** Versões da FIPE escolhidas (uma na versão, várias na família). */
  labels: string[];
  table: string | null;
};

export type EnrichSummary = {
  checked: number;
  matched: { version: number; family: number };
  /**
   * Por que parou antes de acabar os pendentes; nulo se acabou. Só `unavailable` é falha: tempo e limite de pedidos
   * deixam o resto para a próxima execução.
   */
  stoppedBy: { kind: "time" | "budget" | "unavailable"; message: string } | null;
};

type PendingListing = {
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  fuel: string | null;
  category: string | null;
  status: ListingStatus;
  endsAt: Date | null;
  firstSeenAt: Date;
};

export async function enrichMarketValues(input: {
  client: FipeClient;
  now: () => Date;
  /** Fim do tempo (ms desde a época); depois dele nenhum anúncio novo é tentado. */
  deadline: number;
  /** Máximo de anúncios nesta chamada. */
  limit?: number;
  /** Só calcula e devolve as amostras, sem gravar (conferência manual). */
  dryRun?: boolean;
  /** Só os anúncios desta fonte. */
  sourceId?: string;
  onSample?: (sample: MatchSample) => void;
}): Promise<EnrichSummary> {
  const { client, now, deadline, limit = Number.POSITIVE_INFINITY, dryRun = false, sourceId, onSample } = input;
  const summary: EnrichSummary = { checked: 0, matched: { version: 0, family: 0 }, stoppedBy: null };
  const seen = new Set<string>();
  let tables: FipeTable[] | null = null;

  while (summary.checked < limit) {
    const batch: PendingListing[] = await db.listing.findMany({
      where: {
        // Sem gravar, os já vistos continuam pendentes: ficam de fora pelo id.
        ...(dryRun ? { id: { notIn: [...seen] } } : {}),
        ...(sourceId === undefined ? {} : { sourceId }),
        marketValueCents: null,
        marketValueOrigin: null,
        marketValueCheckedAt: null,
        category: { in: VEHICLE_CATEGORIES },
        brand: { not: null },
        modelYear: { not: null },
      },
      // Abertos primeiro: é neles que o valor ajuda a decidir; depois o acervo, do mais novo ao mais antigo.
      orderBy: [{ status: "asc" }, { firstSeenAt: "desc" }],
      take: Math.min(BATCH, limit - summary.checked),
      select: {
        id: true,
        title: true,
        brand: true,
        model: true,
        modelYear: true,
        fuel: true,
        category: true,
        status: true,
        endsAt: true,
        firstSeenAt: true,
      },
    });
    if (batch.length === 0) break;

    for (const listing of batch) {
      if (now().getTime() >= deadline) {
        summary.stoppedBy = { kind: "time", message: "tempo esgotado" };
        return summary;
      }
      seen.add(listing.id);
      let sample: MatchSample;
      try {
        tables ??= await client.tables();
        sample = await matchListing(client, tables, listing);
      } catch (error) {
        // FIPE fora do ar: o anúncio fica pendente e a próxima execução tenta de novo.
        if (error instanceof FipeUnavailableError) {
          summary.stoppedBy = {
            kind: error instanceof FipeBudgetError ? "budget" : "unavailable",
            message: error.message,
          };
          return summary;
        }
        throw error;
      }
      summary.checked++;
      if (sample.match) summary.matched[sample.match.origin === "fipe_version" ? "version" : "family"]++;
      onSample?.(sample);
      if (!dryRun) await saveMatch(listing.id, sample, tables, now());
    }
  }
  return summary;
}

async function matchListing(client: FipeClient, tables: FipeTable[], listing: PendingListing): Promise<MatchSample> {
  const result = (reason: MatchReason, extra: Partial<MatchSample> = {}): MatchSample => ({
    listingId: listing.id,
    title: listing.title,
    reason,
    match: null,
    labels: [],
    table: null,
    ...extra,
  });
  const types = fipeVehicleTypes(toListingCategory(listing.category));
  const table = pickFipeTable(fipeReferenceMonth(listing), tables);
  if (types.length === 0 || table === null || listing.modelYear === null) return result("no_type");

  let found: { type: FipeVehicleType; brand: FipeOption } | null = null;
  for (const type of types) {
    const brand = matchFipeBrand(listing.brand, await client.brands(table, type));
    if (brand) {
      found = { type, brand };
      break;
    }
  }
  if (found === null) return result("no_brand", { table: table.code });
  const { type, brand } = found;

  // Candidatas de todos os combustíveis possíveis: a FIPE lista a moto flex ora como gasolina, ora como flex.
  const candidates: FipeOption[] = [];
  const fuelOf = new Map<string, number>();
  for (const fuel of fipeFuelCodes(type, listing.fuel)) {
    for (const model of await client.modelsByYear(table, type, brand.code, listing.modelYear, fuel)) {
      if (fuelOf.has(model.code)) continue;
      fuelOf.set(model.code, fuel);
      candidates.push(model);
    }
  }
  const choice = chooseFipeModels(listing.model, candidates);
  if (choice.kind === "none") return result(choice.reason, { table: table.code });

  const codes = choice.kind === "version" ? [choice.code] : choice.codes;
  const values = new Map<string, FipeValue>();
  for (const code of codes) {
    const value = await client.value(table, type, brand.code, code, listing.modelYear, fuelOf.get(code) ?? 1);
    if (value) values.set(code, value);
  }
  const match = settleFipeValue(choice, values);
  const labelOf = new Map(candidates.map((model) => [model.code, model.label]));
  const labels = codes.map((code) => labelOf.get(code) ?? code);
  if (match === null) return result(values.size === 0 ? "no_value" : "spread", { table: table.code, labels });
  return result("matched", { match, labels, table: table.code });
}

async function saveMatch(listingId: string, sample: MatchSample, tables: readonly FipeTable[], checkedAt: Date) {
  const table = tables.find((item) => item.code === sample.table) ?? null;
  // Só se continua sem valor: a fonte pode ter informado o dela enquanto a FIPE respondia.
  const where = { id: listingId, marketValueOrigin: null, marketValueCents: null };
  if (sample.match === null || table === null) {
    await db.listing.updateMany({ where, data: { marketValueCheckedAt: checkedAt } });
    return;
  }
  await db.listing.updateMany({
    where,
    data: {
      marketValueCents: sample.match.value,
      marketValueOrigin: sample.match.origin,
      marketValueFipeCode: sample.match.fipeCode,
      marketValueRefMonth: table.month,
      marketValueCheckedAt: checkedAt,
    },
  });
}
