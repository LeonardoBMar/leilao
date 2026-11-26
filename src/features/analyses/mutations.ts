import "server-only";

import { FORMULA_VERSION, prepareFixedAnalysis } from "@/domain/finance/calculator";
import { getUserPreferences } from "@/features/preferences/queries";
import { getLotMarketReference, getLotMarketReferences } from "@/features/research/queries";
import { err, ok, type Result } from "@/lib/result";
import { requireUser } from "@/server/auth";
import { db, isUniqueViolation } from "@/server/db";

import {
  defaultsInputFromListing,
  draftDefaults,
  draftSourceOf,
  listingForDefaultsSelect,
  UNKNOWN_VEHICLE,
} from "./draft-defaults";
import { snapshotOf } from "./market-snapshot";
import { analysisColumns, toInputs } from "./queries";
import { type AnalysisForm, toAnalysisInputs, toAnalysisReferences } from "./schemas";

/** Formulário → colunas. Opcionais ausentes viram `null` (no update, `undefined` manteria o valor antigo). */
function toAnalysisData(form: AnalysisForm) {
  const inputs = toAnalysisInputs(form);
  const references = toAnalysisReferences(form);
  return {
    marketValueCents: inputs.marketValue,
    repairCostCents: inputs.repairCost,
    documentationCostCents: inputs.documentationCost,
    transportCostCents: inputs.transportCost,
    tiresCostCents: inputs.tiresCost,
    serviceCostCents: inputs.serviceCost,
    otherFeesCents: inputs.otherFees,
    debtsCostCents: inputs.debtsCost,
    sellingCostCents: inputs.sellingCost,
    taxCostCents: inputs.taxCost,
    expectedHoldDays: references.expectedHoldDays,
    commissionMode: inputs.commissionMode,
    commissionFixedCents: inputs.commissionFixed,
    commissionRateBps: inputs.commissionRateBps,
    riskReserveCents: inputs.riskReserve,
    riskReserveBps: inputs.riskReserveRateBps,
    desiredMarginCents: inputs.desiredMargin,
    desiredMarginBps: inputs.desiredMarginRateBps,
    marketReferenceDate: references.marketReferenceDate,
    marketReferenceSource: references.marketReferenceSource,
    fipeValueCents: references.fipeValue,
    fipeReferenceMonth: references.fipeReferenceMonth,
    fipeReferenceSource: references.fipeReferenceSource,
    notes: references.notes,
    knownResultAtCreation: references.knownResultAtCreation,
  };
}

export type CreateDraftError = "lot_not_found" | "source_not_found";

/**
 * Abre um rascunho para o lote (RF-05). Se já existir um, devolve o existente (no máximo um por lote).
 * Revisar uma versão fixada copia suas premissas; sem origem indicada, parte da última fixada, se houver. Sem versão
 * fixada, nasce com as premissas padrão (D-38), a partir do anúncio ligado ao lote quando houver.
 */
export async function createDraft(lotId: string, sourceId?: string): Promise<Result<{ id: string }, CreateDraftError>> {
  const user = await requireUser();
  const lot = await db.lot.findFirst({
    where: { id: lotId, ownerId: user.id },
    select: {
      id: true,
      _count: { select: { results: true } },
      listing: { select: { ...listingForDefaultsSelect, lastCheckedAt: true, source: { select: { name: true } } } },
    },
  });
  if (!lot) return err("lot_not_found");

  const existing = await db.analysis.findFirst({
    where: { lotId, ownerId: user.id, status: "draft" },
    select: { id: true },
  });
  if (existing) return ok(existing);

  const source = await db.analysis.findFirst({
    where: { lotId, ownerId: user.id, status: "fixed", ...(sourceId ? { id: sourceId } : {}) },
    orderBy: { version: "desc" },
    select: {
      ...analysisColumns,
      marketReferenceDate: true,
      marketReferenceSource: true,
      fipeValueCents: true,
      fipeReferenceMonth: true,
      fipeReferenceSource: true,
      expectedHoldDays: true,
      notes: true,
    },
  });
  if (sourceId && !source) return err("source_not_found");
  const { listing } = lot;
  const preferences = source ? null : await getUserPreferences();
  const premises =
    source ??
    (listing
      ? draftDefaults(
          defaultsInputFromListing(listing, preferences?.region),
          draftSourceOf(listing),
          preferences?.costOverrides,
        )
      : draftDefaults(UNKNOWN_VEHICLE, null, preferences?.costOverrides));

  try {
    const draft = await db.$transaction(async (tx) => {
      const { _max } = await tx.analysis.aggregate({ where: { lotId, ownerId: user.id }, _max: { version: true } });
      return tx.analysis.create({
        data: {
          ...premises,
          ownerId: user.id,
          lotId,
          version: (_max.version ?? 0) + 1,
          status: "draft",
          // Com resultado já registrado, a análise nasce marcada como feita conhecendo o desfecho (SPEC §10).
          knownResultAtCreation: lot._count.results > 0,
        },
        select: { id: true },
      });
    });
    return ok(draft);
  } catch (error) {
    // Outro rascunho criado em paralelo (índice parcial único): usar o que venceu.
    if (!isUniqueViolation(error)) throw error;
    const winner = await db.analysis.findFirst({
      where: { lotId, ownerId: user.id, status: "draft" },
      select: { id: true },
    });
    if (!winner) throw error;
    return ok(winner);
  }
}

export type SaveDraftError = "not_found" | "not_draft" | "stale_draft";

export async function saveDraft(
  id: string,
  form: AnalysisForm,
  expectedUpdatedAt?: Date,
): Promise<Result<{ updatedAt: Date }, SaveDraftError>> {
  const user = await requireUser();
  const updatedAt = new Date();
  const { count } = await db.analysis.updateMany({
    where: {
      id,
      ownerId: user.id,
      status: "draft",
      ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}),
    },
    data: { ...toAnalysisData(form), updatedAt },
  });
  if (count > 0) return ok({ updatedAt });
  if (expectedUpdatedAt) {
    const stillDraft = await db.analysis.findFirst({
      where: { id, ownerId: user.id, status: "draft" },
      select: { id: true },
    });
    if (stillDraft) return err("stale_draft");
  }
  return err(await whyNotDraft(id, user.id));
}

export type FixAnalysisError = SaveDraftError | "incomplete" | "market_value_not_positive";

/**
 * Fixa o rascunho (RF-05). O servidor recalcula as saídas a partir das entradas, sem confiar em totais do
 * navegador (SPEC §7.6), e grava a versão da fórmula e o mercado do lote (D-74). Depois disso a linha é imutável
 * (trigger do banco).
 */
export async function fixAnalysis(id: string, form: AnalysisForm): Promise<Result<null, FixAnalysisError>> {
  const user = await requireUser();
  const prepared = prepareFixedAnalysis(toAnalysisInputs(form));
  if (!prepared.ok) return err(prepared.error);
  const { isViable, maxBid, totalAtMaxBid, marginAtMaxBid, riskReserve, desiredMargin } = prepared.value;

  const outputs = isViable
    ? {
        isViable: true,
        maxBidCents: maxBid,
        totalAtMaxBidCents: totalAtMaxBid,
        marginAtMaxBidCents: marginAtMaxBid,
      }
    : { isViable: false, maxBidCents: null, totalAtMaxBidCents: null, marginAtMaxBidCents: null };

  // Mercado do lote no momento da fixação (D-74), gravado no mesmo UPDATE: depois dele a linha é imutável.
  const draft = await db.analysis.findFirst({
    where: { id, ownerId: user.id, status: "draft" },
    select: { lotId: true, lot: { select: { _count: { select: { results: true } } } } },
  });
  if (!draft) return err(await whyNotDraft(id, user.id));
  const market = await getLotMarketReference(draft.lotId);
  const fixedAt = new Date();
  const analysisData = toAnalysisData(form);

  const { count } = await db.analysis.updateMany({
    where: { id, ownerId: user.id, status: "draft" },
    data: {
      ...analysisData,
      knownResultAtCreation: analysisData.knownResultAtCreation || draft.lot._count.results > 0,
      ...(market === null ? {} : { marketSnapshot: snapshotOf(market, fixedAt) }),
      // Reserva e margem em %: a versão fixada guarda também o valor aplicado em R$ (D-38).
      riskReserveCents: riskReserve,
      desiredMarginCents: desiredMargin,
      ...outputs,
      formulaVersion: FORMULA_VERSION,
      status: "fixed",
      fixedAt,
    },
  });
  return count > 0 ? ok(null) : err(await whyNotDraft(id, user.id));
}

export type FixAllDraftsOutcome = { fixed: number; skipped: number };

/**
 * Fixa em lote os rascunhos ativos completos do usuário (todos ou os selecionados) com as premissas já preenchidas,
 * recalculando saídas e snapshot de mercado no servidor. Rascunhos incompletos permanecem em aberto.
 */
export async function fixAllReadyDrafts(analysisIds?: readonly string[]): Promise<FixAllDraftsOutcome> {
  const user = await requireUser();
  const activeLot = { archivedAt: null, auction: { archivedAt: null } };
  const drafts = await db.analysis.findMany({
    where: {
      ownerId: user.id,
      status: "draft",
      lot: activeLot,
      ...(analysisIds ? { id: { in: [...analysisIds] } } : {}),
    },
    select: {
      id: true,
      lotId: true,
      updatedAt: true,
      knownResultAtCreation: true,
      ...analysisColumns,
      lot: { select: { _count: { select: { results: true } } } },
    },
  });

  const ready: {
    id: string;
    lotId: string;
    updatedAt: Date;
    knownResultAtCreation: boolean;
    hasResult: boolean;
    prepared: Extract<ReturnType<typeof prepareFixedAnalysis>, { ok: true }>["value"];
  }[] = [];
  let skipped = 0;

  for (const draft of drafts) {
    const prepared = prepareFixedAnalysis(toInputs(draft));
    if (!prepared.ok) {
      skipped += 1;
      continue;
    }
    ready.push({
      id: draft.id,
      lotId: draft.lotId,
      updatedAt: draft.updatedAt,
      knownResultAtCreation: draft.knownResultAtCreation,
      hasResult: draft.lot._count.results > 0,
      prepared: prepared.value,
    });
  }

  if (ready.length === 0) return { fixed: 0, skipped };

  const markets = await getLotMarketReferences(ready.map((item) => item.lotId));
  const fixedAt = new Date();

  const results = await db.$transaction(
    ready.map((item) => {
      const market = markets.get(item.lotId);
      return db.analysis.updateMany({
        where: { id: item.id, ownerId: user.id, status: "draft", updatedAt: item.updatedAt },
        data: {
          ...(market === undefined ? {} : { marketSnapshot: snapshotOf(market, fixedAt) }),
          riskReserveCents: item.prepared.riskReserve,
          desiredMarginCents: item.prepared.desiredMargin,
          isViable: item.prepared.isViable,
          maxBidCents: item.prepared.maxBid,
          totalAtMaxBidCents: item.prepared.totalAtMaxBid,
          marginAtMaxBidCents: item.prepared.marginAtMaxBid,
          knownResultAtCreation: item.knownResultAtCreation || item.hasResult,
          formulaVersion: FORMULA_VERSION,
          status: "fixed",
          fixedAt,
        },
      });
    }),
  );

  const fixed = results.reduce((total, { count }) => total + count, 0);
  const skippedConcurrent = ready.length - fixed;
  return { fixed, skipped: skipped + skippedConcurrent };
}

/** Descarta o rascunho. Versões fixadas nunca são removidas. */
export async function discardDraft(id: string): Promise<Result<{ lotId: string }, SaveDraftError>> {
  const user = await requireUser();
  const draft = await db.analysis.findFirst({
    where: { id, ownerId: user.id, status: "draft" },
    select: { lotId: true },
  });
  if (!draft) return err(await whyNotDraft(id, user.id));

  const { count } = await db.analysis.deleteMany({ where: { id, ownerId: user.id, status: "draft" } });
  return count > 0 ? ok(draft) : err(await whyNotDraft(id, user.id));
}

async function whyNotDraft(id: string, ownerId: string): Promise<SaveDraftError> {
  const exists = await db.analysis.findFirst({ where: { id, ownerId }, select: { id: true } });
  return exists ? "not_draft" : "not_found";
}
