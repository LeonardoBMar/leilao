import { describe, expect, it } from "vitest";

import { bps, cents } from "../money";
import type { AnalysisInputs } from "./calculator";
import { type AnalysisDiffSnapshot, diffAnalyses } from "./diff";

const baseInputs: AnalysisInputs = {
  marketValue: cents(5_000_000),
  repairCost: cents(500_000),
  documentationCost: cents(100_000),
  transportCost: cents(80_000),
  tiresCost: cents(0),
  serviceCost: cents(0),
  otherFees: cents(0),
  commissionMode: "percentage",
  commissionFixed: null,
  commissionRateBps: bps(500),
  riskReserve: cents(200_000),
  riskReserveRateBps: null,
  desiredMargin: cents(600_000),
  desiredMarginRateBps: null,
};

const snapshot = (overrides: Partial<AnalysisDiffSnapshot> = {}): AnalysisDiffSnapshot => ({
  id: "00000000-0000-7000-8000-000000000001",
  version: 1,
  status: "fixed",
  inputs: baseInputs,
  fipeValue: cents(5_500_000),
  maxBid: cents(3_352_381),
  isViable: true,
  notes: "Nota inicial",
  ...overrides,
});

describe("diffAnalyses", () => {
  it("retorna lista vazia quando nenhuma premissa nem nota mudou", () => {
    const result = diffAnalyses(snapshot({ version: 1 }), snapshot({ version: 2 }));
    expect(result.changes).toEqual([]);
    expect(result.notesChanged).toBe(false);
    expect(result.maxBidDelta).toBe(0);
    expect(result.viabilityChanged).toBe(false);
  });

  it("detecta alteração de custos, FIPE, notas e calcula delta do lance máximo", () => {
    const v1 = snapshot({ version: 1, maxBid: cents(3_352_381) });
    const v2 = snapshot({
      version: 2,
      inputs: { ...baseInputs, repairCost: cents(800_000) },
      fipeValue: cents(5_400_000),
      maxBid: cents(3_066_667),
      notes: "Subiu reparo após vistoria",
    });

    const result = diffAnalyses(v1, v2);
    expect(result.changes.map((item) => item.field)).toEqual(["fipeValue", "repairCost"]);
    expect(result.changes[0]?.deltaCents).toBe(-100_000);
    expect(result.changes[1]?.deltaCents).toBe(300_000);
    expect(result.maxBidDelta).toBe(3_066_667 - 3_352_381);
    expect(result.notesChanged).toBe(true);
  });

  it("ignora comissão fixa inativa quando ambas as versões são percentuais", () => {
    const v1 = snapshot({ inputs: { ...baseInputs, commissionFixed: cents(100_000) } });
    const v2 = snapshot({ inputs: { ...baseInputs, commissionFixed: null } });
    expect(diffAnalyses(v1, v2).changes).toEqual([]);
  });

  it("detecta mudança de modalidade de comissão e troca de margem R$ para %", () => {
    const v1 = snapshot({ version: 1 });
    const v2 = snapshot({
      version: 2,
      inputs: {
        ...baseInputs,
        commissionMode: "fixed",
        commissionFixed: cents(200_000),
        desiredMargin: null,
        desiredMarginRateBps: bps(1_500),
      },
      isViable: false,
      maxBid: null,
    });

    const result = diffAnalyses(v1, v2);
    expect(result.changes.map((item) => item.field)).toEqual(["commission", "desiredMargin"]);
    expect(result.changes[0]?.deltaCents).toBeNull();
    expect(result.changes[0]?.deltaBps).toBeNull();
    expect(result.viabilityChanged).toBe(true);
    expect(result.maxBidDelta).toBeNull();
  });
});
