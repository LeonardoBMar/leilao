import "server-only";

import {
  chooseFipeModels,
  fipeFuelCodes,
  type FipeMatch,
  type FipeMatchModel,
  fipeReferenceMonth,
  type FipeTable,
  type FipeVehicleIdentity,
  fipeVehicleIdentity,
  type FipeVehicleType,
  fipeVehicleTypes,
  isOutOfFipeVehicle,
  needsRematch,
  pickFipeTable,
  resolveFipeBrandAndModel,
  settleFipeValue,
} from "@/domain/listings/fipe-match";
import { type ListingStatus, toListingCategory } from "@/domain/listings/types";

import { db } from "../db";
import type { FipeCatalog } from "./catalog";
import {
  findFipeMatch,
  type FipeMatchChoice,
  fipePendingListingWhere,
  notFromSource,
  requeueStaleMatches,
  saveAutoMatch,
  type StoredFipeMatch,
} from "./matches";

/**
 * Casa na tabela FIPE oficial o valor de mercado dos anúncios sem valor da fonte (D-47, D-49, D-51; planos
 * docs/PLANO-VALOR-MERCADO.md e docs/PLANO-FIPE-TABELAS.md). Duas etapas: a **escolha** da versão vem da correlação
 * do veículo (`fipe_matches`), feita uma vez por chave; o **valor** vem da tabela do mês no catálogo (`fipe_prices`).
 * Tudo no banco, sem pedido à FIPE. Roda junto com a coleta e pelo `npm run db:market-values`. Cada anúncio é tentado
 * uma vez (`market_value_checked_at`); volta a ser tentado se o veículo mudar, se a regra mudar, se alguém corrigir a
 * correlação ou se chegar a tabela do mês dele (o valor veio de uma anterior).
 */

const BATCH = 50;
/** Chaves de veículo casadas ao mesmo tempo (D-63): ~1 anúncio por segundo em série, quase tudo espera de rede. */
const CONCURRENCY = 8;

export type MatchReason =
  | "matched"
  | "no_type"
  | "no_brand"
  | "out_of_fipe"
  | "year_out_of_range"
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
  /** Mês da tabela do valor: o do anúncio ou, enquanto ela não chega, o mais recente antes dele. */
  referenceMonth: Date | null;
  /** Correlação usada; nula quando o veículo não tem chave (sem categoria de veículo, por exemplo). */
  matchId: string | null;
};

export type EnrichSummary = {
  checked: number;
  matched: { version: number; family: number };
  /** Por que parou antes de acabar os pendentes; nulo se acabou. O resto fica para a próxima execução. */
  stoppedBy: { kind: "time" | "no_catalog"; message: string } | null;
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
  catalog: FipeCatalog;
  now: () => Date;
  /** Fim do tempo (ms desde a época); depois dele nenhum anúncio novo é tentado. */
  deadline: number;
  /** Máximo de anúncios nesta chamada. */
  limit?: number;
  /** Chaves de veículo processadas em paralelo (padrão 8; menor durante a coleta paralela para poupar conexões). */
  concurrency?: number;
  /** Só calcula e devolve as amostras, sem gravar (conferência manual). */
  dryRun?: boolean;
  /** Só os anúncios desta fonte. */
  sourceId?: string;
  onSample?: (sample: MatchSample) => void;
}): Promise<EnrichSummary> {
  const {
    catalog,
    now,
    deadline,
    limit = Number.POSITIVE_INFINITY,
    concurrency = CONCURRENCY,
    dryRun = false,
    sourceId,
    onSample,
  } = input;
  const summary: EnrichSummary = { checked: 0, matched: { version: 0, family: 0 }, stoppedBy: null };
  // Só no `dryRun` (nada é gravado, então os anúncios continuariam pendentes na query).
  const seen = new Set<string>();
  const tables = await catalog.tables();
  if (tables.length === 0) {
    summary.stoppedBy = { kind: "no_catalog", message: "catálogo da FIPE vazio (nenhum mês importado)" };
    return summary;
  }
  if (!dryRun) await requeueStaleMatches();

  while (summary.checked < limit) {
    const batch: PendingListing[] = await db.listing.findMany({
      where: {
        ...(dryRun && seen.size > 0 ? { id: { notIn: [...seen] } } : {}),
        ...(sourceId === undefined ? {} : { sourceId }),
        ...fipePendingListingWhere,
      },
      // Abertos primeiro: é neles que o valor ajuda a decidir; depois o acervo, do mais novo ao mais antigo.
      orderBy: [{ status: "asc" }, { firstSeenAt: "desc" }],
      take: Math.min(BATCH, limit - summary.checked),
      select: pendingListingSelect,
    });
    if (batch.length === 0) break;

    await runByKey(batch, identityKeyOf, concurrency, async (listing) => {
      if (summary.stoppedBy) return;
      if (now().getTime() >= deadline) {
        summary.stoppedBy = { kind: "time", message: "tempo esgotado" };
        return;
      }
      if (dryRun) seen.add(listing.id);
      const sample = await evaluateListing(catalog, tables, listing, { dryRun });
      summary.checked++;
      if (sample.match) summary.matched[sample.match.origin === "fipe_version" ? "version" : "family"]++;
      onSample?.(sample);
      if (!dryRun) await saveOutcome(listing.id, sample, now());
    });
    if (summary.stoppedBy) return summary;
  }
  return summary;
}

/** Chave da correlação do anúncio; sem chave (fora das categorias de veículo), o próprio anúncio. */
function identityKeyOf(listing: PendingListing): string {
  const identity = fipeVehicleIdentity({ ...listing, category: toListingCategory(listing.category) });
  return identity?.key ?? listing.id;
}

/**
 * Até `limit` chaves ao mesmo tempo, os itens da mesma chave um depois do outro: o tempo de cada anúncio é quase todo
 * de ida e volta ao banco, e a correlação nova de uma chave (`saveAutoMatch`) só pode ser criada por um de cada vez.
 */
async function runByKey<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  limit: number,
  run: (item: T) => Promise<void>,
): Promise<void> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  const queue = [...groups.values()];
  const worker = async () => {
    for (let group = queue.shift(); group !== undefined; group = queue.shift()) {
      for (const item of group) await run(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}

/**
 * Escolha (correlação guardada ou refeita) e valor (tabela do mês do anúncio, ou a mais recente antes dele) de um
 * anúncio. Sem gravar o anúncio; a correlação nova é gravada, salvo em `dryRun`.
 */
export async function evaluateListing(
  catalog: FipeCatalog,
  tables: readonly FipeTable[],
  listing: PendingListing,
  options: { dryRun?: boolean } = {},
): Promise<MatchSample> {
  const base = { listingId: listing.id, title: listing.title, match: null, labels: [], referenceMonth: null };
  const category = toListingCategory(listing.category);
  const identity = fipeVehicleIdentity({ ...listing, category });
  const table = pickFipeTable(fipeReferenceMonth(listing), tables);
  if (identity === null || table === null) return { ...base, reason: "no_type", matchId: null };

  const match = await resolveMatch(catalog, table, identity, options.dryRun ?? false);
  const matchId = match.id || null;
  if (match.kind === "none" || match.vehicleType === null || match.brandCode === null) {
    return { ...base, reason: noneReason(match.reason), matchId };
  }
  const { models } = match;
  const labels = models.map((model) => model.label);
  const choice =
    match.kind === "version" && models[0]
      ? { kind: "version" as const, code: models[0].code }
      : { kind: "family" as const, codes: models.map((model) => model.code) };

  const values = await catalog.values(table, identity.modelYear, models);
  const settled = settleFipeValue(choice, values);
  if (settled === null) return { ...base, reason: values.size === 0 ? "no_value" : "spread", labels, matchId };
  return { ...base, reason: "matched", match: settled, labels, referenceMonth: table.month, matchId };
}

function noneReason(reason: string | null): MatchReason {
  const known: readonly MatchReason[] = [
    "no_type",
    "no_brand",
    "out_of_fipe",
    "year_out_of_range",
    "no_model",
    "no_candidates",
    "too_many",
  ];
  return known.find((item) => item === reason) ?? "no_candidates";
}

/** Correlação da chave: a guardada, se vale; senão a regra escolhe sobre as listas da tabela do anúncio e grava. */
async function resolveMatch(
  catalog: FipeCatalog,
  table: FipeTable,
  identity: FipeVehicleIdentity,
  dryRun: boolean,
): Promise<StoredFipeMatch> {
  const stored = await findFipeMatch(identity.key);
  if (stored && !needsRematch(stored)) return stored;
  const choice = await chooseForTable(catalog, table, identity);
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

/**
 * A regra de D-47 sobre as listas do catálogo: tenta cada tipo compatível e cada marca casada (ex.: "Caoa Chery" e
 * "Caoa Chery/Chery"; "Pesados" tentando caminhões e depois carros/utilitários) até encontrar versão/família. Quando
 * nada casa, distingue divergência real (`out_of_fipe`, `year_out_of_range`) de pendência identificável (`no_brand`,
 * `no_candidates`, `no_model`, `too_many`).
 */
export async function chooseForTable(
  catalog: FipeCatalog,
  table: FipeTable,
  identity: FipeVehicleIdentity,
): Promise<FipeMatchChoice> {
  const types = fipeVehicleTypes(identity.category);
  const primaryType = types[0] ?? null;
  let firstBrand: { type: FipeVehicleType; brandCode: string } | null = null;
  let firstNonEmptyFailure: { type: FipeVehicleType; brandCode: string; reason: string } | null = null;
  let primaryHadCandidates = false;
  let anyHadCandidates = false;
  let allNoModel = true;

  for (const type of types) {
    const brands = await catalog.brands(table, type);
    const { matchedBrands, model } = resolveFipeBrandAndModel(identity.brand, identity.model, brands);
    for (const brand of matchedBrands) {
      if (firstBrand === null) firstBrand = { type, brandCode: brand.code };
      if (model !== null) allNoModel = false;

      // Candidatas de todos os combustíveis possíveis: a FIPE lista a moto flex ora como gasolina, ora como flex,
      // e híbridos como 6 (híbrido) ou 1/5.
      const candidates: FipeMatchModel[] = [];
      for (const fuel of fipeFuelCodes(type, identity.fuel)) {
        for (const item of await catalog.modelsByYear(table, type, brand.code, identity.modelYear, fuel)) {
          if (candidates.some((existing) => existing.code === item.code)) continue;
          candidates.push({ code: item.code, fuel, label: item.label });
        }
      }

      if (candidates.length === 0) continue;
      anyHadCandidates = true;
      if (type === primaryType) primaryHadCandidates = true;

      const choice = chooseFipeModels(model, candidates);
      if (choice.kind !== "none") {
        const codes = choice.kind === "version" ? [choice.code] : choice.codes;
        const models = codes.flatMap((code) => candidates.filter((item) => item.code === code));
        return { kind: choice.kind, vehicleType: type, brandCode: brand.code, models };
      }
      if (firstNonEmptyFailure === null) {
        firstNonEmptyFailure = { type, brandCode: brand.code, reason: choice.reason };
      }
    }
  }

  if (firstBrand === null) {
    const reason = isOutOfFipeVehicle(identity.brand, identity.model) ? "out_of_fipe" : "no_brand";
    return { kind: "none", reason, vehicleType: null, brandCode: null };
  }
  if (allNoModel) {
    return { kind: "none", reason: "no_model", vehicleType: firstBrand.type, brandCode: firstBrand.brandCode };
  }
  if (isOutOfFipeVehicle(identity.brand, identity.model)) {
    return { kind: "none", reason: "out_of_fipe", vehicleType: firstBrand.type, brandCode: firstBrand.brandCode };
  }
  // Se o tipo primário da categoria não tem nenhum modelo nesse ano (ex.: carro 1982, antes do início da FIPE em 1985),
  // o fallback para caminhões (que começa em 1981) não transforma ano fora da faixa em "no_candidates".
  if (!anyHadCandidates || (firstBrand.type === primaryType && !primaryHadCandidates)) {
    return { kind: "none", reason: "year_out_of_range", vehicleType: firstBrand.type, brandCode: firstBrand.brandCode };
  }
  const failure = firstNonEmptyFailure ?? { ...firstBrand, reason: "no_candidates" };
  return { kind: "none", reason: failure.reason, vehicleType: failure.type, brandCode: failure.brandCode };
}

/** Grava o resultado no anúncio, só se ele continua sem valor da fonte (a fonte pode ter informado o dela no meio). */
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
      marketValueCheckedAt: checkedAt,
      ...link,
    },
  });
}
