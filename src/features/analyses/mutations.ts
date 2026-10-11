import "server-only";

import { calculateMaxBid, completeInputs, FORMULA_VERSION } from "@/domain/finance/calculator";
import { getLotMarketReference } from "@/features/research/queries";
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
import { analysisColumns } from "./queries";
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
      notes: true,
    },
  });
  if (sourceId && !source) return err("source_not_found");
  const { listing } = lot;
  const premises =
    source ??
    (listing
      ? draftDefaults(defaultsInputFromListing(listing), draftSourceOf(listing))
      : draftDefaults(UNKNOWN_VEHICLE, null));

  try {
    const draft = await db.$transaction(async (tx) => {
      const { _max } = await tx.analysis.aggregate({ where: { lotId }, _max: { version: true } });
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

export type SaveDraftError = "not_found" | "not_draft";

export async function saveDraft(id: string, form: AnalysisForm): Promise<Result<null, SaveDraftError>> {
  const user = await requireUser();
  const { count } = await db.analysis.updateMany({
    where: { id, ownerId: user.id, status: "draft" },
    data: toAnalysisData(form),
  });
  return count > 0 ? ok(null) : err(await whyNotDraft(id, user.id));
}

export type FixAnalysisError = SaveDraftError | "incomplete" | "market_value_not_positive";

/**
 * Fixa o rascunho (RF-05). O servidor recalcula as saídas a partir das entradas, sem confiar em totais do
 * navegador (SPEC §7.6), e grava a versão da fórmula e o mercado do lote (D-74). Depois disso a linha é imutável
 * (trigger do banco).
 */
export async function fixAnalysis(id: string, form: AnalysisForm): Promise<Result<null, FixAnalysisError>> {
  const user = await requireUser();
  const inputs = toAnalysisInputs(form);
  const outcome = calculateMaxBid(inputs);
  const complete = completeInputs(inputs);
  if (outcome.kind === "incomplete" || !complete.ok) return err("incomplete");
  if (inputs.marketValue === null || inputs.marketValue <= 0) return err("market_value_not_positive");

  const outputs =
    outcome.kind === "viable"
      ? {
          isViable: true,
          maxBidCents: outcome.maxBid,
          totalAtMaxBidCents: outcome.totalAtMaxBid,
          marginAtMaxBidCents: outcome.marginAtMaxBid,
        }
      : { isViable: false, maxBidCents: null, totalAtMaxBidCents: null, marginAtMaxBidCents: null };

  // Mercado do lote no momento da fixação (D-74), gravado no mesmo UPDATE: depois dele a linha é imutável.
  const draft = await db.analysis.findFirst({
    where: { id, ownerId: user.id, status: "draft" },
    select: { lotId: true },
  });
  if (!draft) return err(await whyNotDraft(id, user.id));
  const market = await getLotMarketReference(draft.lotId);
  const fixedAt = new Date();

  const { count } = await db.analysis.updateMany({
    where: { id, ownerId: user.id, status: "draft" },
    data: {
      ...toAnalysisData(form),
      ...(market === null ? {} : { marketSnapshot: snapshotOf(market, fixedAt) }),
      // Reserva e margem em %: a versão fixada guarda também o valor aplicado em R$ (D-38).
      riskReserveCents: complete.value.riskReserve,
      desiredMarginCents: complete.value.desiredMargin,
      ...outputs,
      formulaVersion: FORMULA_VERSION,
      status: "fixed",
      fixedAt,
    },
  });
  return count > 0 ? ok(null) : err(await whyNotDraft(id, user.id));
}

/** Descarta o rascunho. Versões fixadas nunca são removidas. */
export async function discardDraft(id: string): Promise<Result<{ lotId: string }, SaveDraftError>> {
  const user = await requireUser();
  const draft = await db.analysis.findFirst({
    where: { id, ownerId: user.id, status: "draft" },
    select: { lotId: true },
  });
  if (!draft) return err(await whyNotDraft(id, user.id));

  await db.analysis.deleteMany({ where: { id, ownerId: user.id, status: "draft" } });
  return ok(draft);
}

async function whyNotDraft(id: string, ownerId: string): Promise<SaveDraftError> {
  const exists = await db.analysis.findFirst({ where: { id, ownerId }, select: { id: true } });
  return exists ? "not_draft" : "not_found";
}
