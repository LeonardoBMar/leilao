import "server-only";

import {
  chooseFipeModels,
  fipeFuelCodes,
  type FipeMatch,
  type FipeMatchModel,
  type FipeOption,
  fipeReferenceMonth,
  type FipeTable,
  type FipeValue,
  type FipeVehicleIdentity,
  fipeVehicleIdentity,
  type FipeVehicleType,
  fipeVehicleTypes,
  matchFipeBrand,
  needsRematch,
  pickFipeTable,
  pickProvisionalPrices,
  settleFipeValue,
} from "@/domain/listings/fipe-match";
import { type ListingStatus, toListingCategory } from "@/domain/listings/types";

import { db } from "../db";
import { findStoredPrices } from "./catalog";
import { FipeBudgetError, type FipeClient, FipeUnavailableError } from "./client";
import {
  findFipeMatch,
  type FipeMatchChoice,
  notFromSource,
  requeueStaleMatches,
  saveAutoMatch,
  type StoredFipeMatch,
} from "./matches";

/**
 * Casa na tabela FIPE oficial o valor de mercado dos anúncios sem valor da fonte (D-47, D-49; planos
 * docs/PLANO-VALOR-MERCADO.md e docs/PLANO-FIPE-TABELAS.md). Duas etapas: a **escolha** da versão vem da correlação
 * do veículo (`fipe_matches`), feita uma vez por chave; o **valor** vem da tabela do mês, guardada ou pedida. Roda
 * junto com a coleta e pelo `npm run db:market-values`. Cada anúncio é tentado uma vez (`market_value_checked_at`);
 * volta a ser tentado se o veículo mudar, se a regra mudar, se alguém corrigir a correlação ou se o valor for
 * provisório.
 */

const VEHICLE_CATEGORIES = ["Carros", "Utilitarios", "Motos", "Pesados"];
const BATCH = 50;

export type MatchReason =
  | "matched"
  | "provisional"
  | "no_type"
  | "no_brand"
  | Extract<ReturnType<typeof chooseFipeModels>, { kind: "none" }>["reason"]
  | "spread"
  | "no_value";

export type MatchSample = {
  listingId: string;
  title: string;
  reason: MatchReason;
  match: FipeMatch | null;
  /** Versões da FIPE escolhidas (uma na versão, várias na família). */
  labels: string[];
  /** Mês da tabela do valor (o do anúncio, ou o anterior no provisório). */
  referenceMonth: Date | null;
  /** Correlação usada; nula quando o veículo não tem chave (sem categoria de veículo, por exemplo). */
  matchId: string | null;
};

export type EnrichSummary = {
  checked: number;
  matched: { version: number; family: number };
  /** Anúncios abertos que ficaram com o valor do mês anterior até a tabela do mês poder ser pedida. */
  provisional: number;
  /**
   * Por que parou antes de acabar os pendentes; nulo se acabou. Só `unavailable` é falha: tempo e limite de pedidos
   * deixam o resto para a próxima execução.
   */
  stoppedBy: { kind: "time" | "budget" | "unavailable"; message: string } | null;
};

export type PendingListing = {
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

export const pendingListingSelect = {
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
} as const;

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
  const summary: EnrichSummary = { checked: 0, matched: { version: 0, family: 0 }, provisional: 0, stoppedBy: null };
  // Já vistos nesta chamada ficam de fora: o provisório e o adiado continuam pendentes.
  const seen = new Set<string>();
  let tables: FipeTable[] | null = null;
  if (!dryRun) await requeueStaleMatches();

  while (summary.checked < limit) {
    const batch: PendingListing[] = await db.listing.findMany({
      where: {
        id: { notIn: [...seen] },
        ...(sourceId === undefined ? {} : { sourceId }),
        marketValueCheckedAt: null,
        ...notFromSource,
        category: { in: VEHICLE_CATEGORIES },
        brand: { not: null },
        modelYear: { not: null },
      },
      // Abertos primeiro: é neles que o valor ajuda a decidir; depois o acervo, do mais novo ao mais antigo.
      orderBy: [{ status: "asc" }, { firstSeenAt: "desc" }],
      take: Math.min(BATCH, limit - summary.checked),
      select: pendingListingSelect,
    });
    if (batch.length === 0) break;

    for (const listing of batch) {
      if (now().getTime() >= deadline) {
        summary.stoppedBy = { kind: "time", message: "tempo esgotado" };
        return summary;
      }
      seen.add(listing.id);
      let outcome: ListingOutcome;
      try {
        tables ??= await client.tables();
        outcome = await evaluateListing(client, tables, listing, { dryRun });
      } catch (error) {
        // Sem a lista de tabelas não há o que fazer sem pedir: para como no fim do tempo.
        if (error instanceof FipeBudgetError) {
          summary.stoppedBy = { kind: "budget", message: error.message };
          return summary;
        }
        // FIPE fora do ar: o anúncio fica pendente e a próxima execução tenta de novo.
        if (error instanceof FipeUnavailableError) {
          summary.stoppedBy = { kind: "unavailable", message: error.message };
          return summary;
        }
        throw error;
      }
      // Limite de pedidos: segue só com o que está guardado (escolhas e preços), sem pedir mais.
      if (outcome.budget) summary.stoppedBy ??= { kind: "budget", message: outcome.budget };
      if (outcome.sample === null) continue;
      const { sample } = outcome;
      summary.checked++;
      if (sample.reason === "provisional") summary.provisional++;
      else if (sample.match) summary.matched[sample.match.origin === "fipe_version" ? "version" : "family"]++;
      onSample?.(sample);
      if (!dryRun) await saveOutcome(listing.id, sample, now());
    }
  }
  return summary;
}

/** `sample` nulo: adiado (faltou pedido para decidir); `budget`: o limite de pedidos foi atingido nesta avaliação. */
export type ListingOutcome = { sample: MatchSample | null; budget: string | null };

/**
 * Escolha (correlação guardada ou refeita) e valor (tabela do mês) de um anúncio. Sem gravar o anúncio; a correlação
 * nova é gravada, salvo em `dryRun`. Pedido barrado pelo limite vira valor provisório (aberto com preço guardado do
 * mês anterior) ou adiamento; FIPE fora do ar lança `FipeUnavailableError`.
 */
export async function evaluateListing(
  client: FipeClient,
  tables: readonly FipeTable[],
  listing: PendingListing,
  options: { dryRun?: boolean } = {},
): Promise<ListingOutcome> {
  const base = { listingId: listing.id, title: listing.title, match: null, labels: [], referenceMonth: null };
  const category = toListingCategory(listing.category);
  const identity = fipeVehicleIdentity({ ...listing, category });
  const table = pickFipeTable(fipeReferenceMonth(listing), tables);
  if (identity === null || table === null) {
    return { sample: { ...base, reason: "no_type", matchId: null }, budget: null };
  }

  let match: StoredFipeMatch;
  try {
    match = await resolveMatch(client, table, identity, options.dryRun ?? false);
  } catch (error) {
    if (error instanceof FipeBudgetError) return { sample: null, budget: error.message };
    throw error;
  }
  const matchId = match.id || null;
  if (match.kind === "none" || match.vehicleType === null || match.brandCode === null) {
    return { sample: { ...base, reason: noneReason(match.reason), matchId }, budget: null };
  }
  const { vehicleType: type, brandCode, models } = match;
  const labels = models.map((model) => model.label);
  const choice =
    match.kind === "version" && models[0]
      ? { kind: "version" as const, code: models[0].code }
      : { kind: "family" as const, codes: models.map((model) => model.code) };

  const values = new Map<string, FipeValue>();
  let budget: string | null = null;
  try {
    for (const model of models) {
      const value = await client.value(table, type, brandCode, model.code, identity.modelYear, model.fuel);
      if (value) values.set(model.code, value);
    }
  } catch (error) {
    if (!(error instanceof FipeBudgetError)) throw error;
    budget = error.message;
  }

  if (budget !== null) {
    // Só anúncio aberto fica com o mês anterior: o encerrado espera a tabela do mês dele.
    const provisional =
      listing.status === "open"
        ? pickProvisionalPrices(
            await findStoredPrices({ type, brandCode, modelYear: identity.modelYear, models }),
            models,
            table.month,
          )
        : null;
    const settled = provisional ? settleFipeValue(choice, provisional.values) : null;
    if (provisional === null || settled === null) return { sample: null, budget };
    return {
      sample: {
        ...base,
        reason: "provisional",
        match: settled,
        labels,
        referenceMonth: provisional.referenceMonth,
        matchId,
      },
      budget,
    };
  }

  const settled = settleFipeValue(choice, values);
  if (settled === null) {
    return { sample: { ...base, reason: values.size === 0 ? "no_value" : "spread", labels, matchId }, budget: null };
  }
  return {
    sample: { ...base, reason: "matched", match: settled, labels, referenceMonth: table.month, matchId },
    budget: null,
  };
}

function noneReason(reason: string | null): MatchReason {
  const known: readonly MatchReason[] = ["no_type", "no_brand", "no_model", "no_candidates", "too_many"];
  return known.find((item) => item === reason) ?? "no_candidates";
}

/** Correlação da chave: a guardada, se vale; senão a regra escolhe sobre as listas da tabela do anúncio e grava. */
async function resolveMatch(
  client: FipeClient,
  table: FipeTable,
  identity: FipeVehicleIdentity,
  dryRun: boolean,
): Promise<StoredFipeMatch> {
  const stored = await findFipeMatch(identity.key);
  if (stored && !needsRematch(stored)) return stored;
  const choice = await chooseForTable(client, table, identity);
  if (dryRun) {
    return {
      id: stored?.id ?? "",
      origin: "auto",
      matcherVersion: 0,
      ...(choice.kind === "none" ? { ...choice, models: [] } : { ...choice, reason: null }),
    };
  }
  return saveAutoMatch(identity, choice);
}

/** A regra de D-47 sobre as listas da FIPE: marca no tipo certo, modelos de todos os combustíveis possíveis. */
export async function chooseForTable(
  client: FipeClient,
  table: FipeTable,
  identity: FipeVehicleIdentity,
): Promise<FipeMatchChoice> {
  let found: { type: FipeVehicleType; brand: FipeOption } | null = null;
  for (const type of fipeVehicleTypes(identity.category)) {
    const brand = matchFipeBrand(identity.brand, await client.brands(table, type));
    if (brand) {
      found = { type, brand };
      break;
    }
  }
  if (found === null) return { kind: "none", reason: "no_brand", vehicleType: null, brandCode: null };
  const { type, brand } = found;

  // Candidatas de todos os combustíveis possíveis: a FIPE lista a moto flex ora como gasolina, ora como flex.
  const candidates: FipeMatchModel[] = [];
  for (const fuel of fipeFuelCodes(type, identity.fuel)) {
    for (const model of await client.modelsByYear(table, type, brand.code, identity.modelYear, fuel)) {
      if (candidates.some((item) => item.code === model.code)) continue;
      candidates.push({ code: model.code, fuel, label: model.label });
    }
  }
  const choice = chooseFipeModels(identity.model, candidates);
  if (choice.kind === "none") return { kind: "none", reason: choice.reason, vehicleType: type, brandCode: brand.code };
  const codes = choice.kind === "version" ? [choice.code] : choice.codes;
  const models = codes.flatMap((code) => candidates.filter((item) => item.code === code));
  return { kind: choice.kind, vehicleType: type, brandCode: brand.code, models };
}

/**
 * Grava o resultado no anúncio, só se ele continua sem valor da fonte (a fonte pode ter informado o dela enquanto a
 * FIPE respondia). Provisório fica pendente, para a tabela do mês substituir quando puder ser pedida.
 */
export async function saveOutcome(listingId: string, sample: MatchSample, checkedAt: Date) {
  const where = { id: listingId, ...notFromSource };
  const link = sample.matchId ? { fipeMatchId: sample.matchId } : { fipeMatchId: null };
  if (sample.match === null) {
    await db.listing.updateMany({
      where,
      data: {
        marketValueCents: null,
        marketValueOrigin: null,
        marketValueFipeCode: null,
        marketValueRefMonth: null,
        marketValueCheckedAt: checkedAt,
        ...link,
      },
    });
    return;
  }
  await db.listing.updateMany({
    where,
    data: {
      marketValueCents: sample.match.value,
      marketValueOrigin: sample.match.origin,
      marketValueFipeCode: sample.match.fipeCode,
      marketValueRefMonth: sample.referenceMonth,
      marketValueCheckedAt: sample.reason === "provisional" ? null : checkedAt,
      ...link,
    },
  });
}
