import { type Bps, type Cents, cents } from "../money";
import { type AnalysisInputs, type CommissionMode } from "./calculator";

/**
 * Comparação estrutural (diff) entre duas versões da análise de um lote (D-88).
 * Puro: compara apenas premissas semanticamente ativas (ex.: ignora comissão fixa quando ambas são percentuais)
 * e devolve somente os campos alterados mais o impacto no lance máximo.
 */

export type AnalysisDiffSnapshot = {
  id: string;
  version: number;
  status: "draft" | "fixed";
  inputs: AnalysisInputs;
  fipeValue: Cents | null;
  maxBid: Cents | null;
  isViable: boolean | null;
  notes: string | null;
};

export type DiffMoneyField =
  | "marketValue"
  | "fipeValue"
  | "repairCost"
  | "documentationCost"
  | "transportCost"
  | "tiresCost"
  | "serviceCost"
  | "otherFees";

export type DiffValue =
  | { kind: "money"; value: Cents | null }
  | { kind: "commission"; mode: CommissionMode | null; fixed: Cents | null; rate: Bps | null }
  | { kind: "rate_or_money"; amount: Cents | null; rate: Bps | null };

export type AnalysisDiffField = DiffMoneyField | "commission" | "riskReserve" | "desiredMargin";

export type AnalysisFieldChange = {
  field: AnalysisDiffField;
  before: DiffValue;
  after: DiffValue;
  /** Diferença numérica (after − before) quando ambos os lados são centavos comparáveis. */
  deltaCents: Cents | null;
  /** Diferença em bps (after − before) quando ambos os lados são percentuais comparáveis. */
  deltaBps: number | null;
};

export type AnalysisDiff = {
  baseVersion: number;
  targetVersion: number;
  changes: AnalysisFieldChange[];
  notesChanged: boolean;
  baseNotes: string | null;
  targetNotes: string | null;
  maxBidDelta: Cents | null;
  viabilityChanged: boolean;
};

const MONEY_FIELDS: readonly DiffMoneyField[] = [
  "marketValue",
  "fipeValue",
  "repairCost",
  "documentationCost",
  "transportCost",
  "tiresCost",
  "serviceCost",
  "otherFees",
];

function moneyValueOf(snapshot: AnalysisDiffSnapshot, field: DiffMoneyField): Cents | null {
  return field === "fipeValue" ? snapshot.fipeValue : snapshot.inputs[field];
}

function commissionChanged(a: AnalysisInputs, b: AnalysisInputs): boolean {
  if (a.commissionMode !== b.commissionMode) return true;
  if (a.commissionMode === "fixed") return a.commissionFixed !== b.commissionFixed;
  if (a.commissionMode === "percentage") return a.commissionRateBps !== b.commissionRateBps;
  return false;
}

function rateOrMoneyDelta(
  beforeAmount: Cents | null,
  beforeRate: Bps | null,
  afterAmount: Cents | null,
  afterRate: Bps | null,
): { changed: boolean; deltaCents: Cents | null; deltaBps: number | null } {
  const beforeIsRate = beforeRate !== null;
  const afterIsRate = afterRate !== null;
  if (beforeIsRate !== afterIsRate) {
    return { changed: true, deltaCents: null, deltaBps: null };
  }
  if (beforeIsRate && afterIsRate) {
    return {
      changed: beforeRate !== afterRate,
      deltaCents: null,
      deltaBps: afterRate - beforeRate,
    };
  }
  const changed = beforeAmount !== afterAmount;
  const deltaCents = beforeAmount !== null && afterAmount !== null ? cents(afterAmount - beforeAmount) : null;
  return { changed, deltaCents, deltaBps: null };
}

function normalizeNotes(value: string | null): string {
  return (value ?? "").trim();
}

export function diffAnalyses(base: AnalysisDiffSnapshot, target: AnalysisDiffSnapshot): AnalysisDiff {
  const changes: AnalysisFieldChange[] = [];

  for (const field of MONEY_FIELDS) {
    const before = moneyValueOf(base, field);
    const after = moneyValueOf(target, field);
    if (before === after) continue;
    changes.push({
      field,
      before: { kind: "money", value: before },
      after: { kind: "money", value: after },
      deltaCents: before !== null && after !== null ? cents(after - before) : null,
      deltaBps: null,
    });
  }

  if (commissionChanged(base.inputs, target.inputs)) {
    const sameFixed = base.inputs.commissionMode === "fixed" && target.inputs.commissionMode === "fixed";
    const samePct = base.inputs.commissionMode === "percentage" && target.inputs.commissionMode === "percentage";
    const deltaCents =
      sameFixed && base.inputs.commissionFixed !== null && target.inputs.commissionFixed !== null
        ? cents(target.inputs.commissionFixed - base.inputs.commissionFixed)
        : null;
    const deltaBps =
      samePct && base.inputs.commissionRateBps !== null && target.inputs.commissionRateBps !== null
        ? target.inputs.commissionRateBps - base.inputs.commissionRateBps
        : null;
    changes.push({
      field: "commission",
      before: {
        kind: "commission",
        mode: base.inputs.commissionMode,
        fixed: base.inputs.commissionFixed,
        rate: base.inputs.commissionRateBps,
      },
      after: {
        kind: "commission",
        mode: target.inputs.commissionMode,
        fixed: target.inputs.commissionFixed,
        rate: target.inputs.commissionRateBps,
      },
      deltaCents,
      deltaBps,
    });
  }

  const reserve = rateOrMoneyDelta(
    base.inputs.riskReserve,
    base.inputs.riskReserveRateBps,
    target.inputs.riskReserve,
    target.inputs.riskReserveRateBps,
  );
  if (reserve.changed) {
    changes.push({
      field: "riskReserve",
      before: { kind: "rate_or_money", amount: base.inputs.riskReserve, rate: base.inputs.riskReserveRateBps },
      after: { kind: "rate_or_money", amount: target.inputs.riskReserve, rate: target.inputs.riskReserveRateBps },
      deltaCents: reserve.deltaCents,
      deltaBps: reserve.deltaBps,
    });
  }

  const margin = rateOrMoneyDelta(
    base.inputs.desiredMargin,
    base.inputs.desiredMarginRateBps,
    target.inputs.desiredMargin,
    target.inputs.desiredMarginRateBps,
  );
  if (margin.changed) {
    changes.push({
      field: "desiredMargin",
      before: { kind: "rate_or_money", amount: base.inputs.desiredMargin, rate: base.inputs.desiredMarginRateBps },
      after: { kind: "rate_or_money", amount: target.inputs.desiredMargin, rate: target.inputs.desiredMarginRateBps },
      deltaCents: margin.deltaCents,
      deltaBps: margin.deltaBps,
    });
  }

  const maxBidDelta = base.maxBid !== null && target.maxBid !== null ? cents(target.maxBid - base.maxBid) : null;
  const viabilityChanged = base.isViable !== null && target.isViable !== null && base.isViable !== target.isViable;
  const notesChanged = normalizeNotes(base.notes) !== normalizeNotes(target.notes);

  return {
    baseVersion: base.version,
    targetVersion: target.version,
    changes,
    notesChanged,
    baseNotes: base.notes,
    targetNotes: target.notes,
    maxBidDelta,
    viabilityChanged,
  };
}
