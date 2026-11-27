import { describe, expect, it } from "vitest";

import {
  DILIGENCE_ITEMS,
  emptyDiligenceChecklist,
  parseDiligenceChecklist,
  plateLookupLinks,
  summarizeDiligence,
} from "./diligence";

describe("diligence", () => {
  it("parseDiligenceChecklist aceita null/lixo/array e preserva apenas chaves booleanas verdadeiras", () => {
    expect(parseDiligenceChecklist(null)).toEqual(emptyDiligenceChecklist());
    expect(parseDiligenceChecklist("invalido")).toEqual(emptyDiligenceChecklist());
    expect(parseDiligenceChecklist([])).toEqual(emptyDiligenceChecklist());
    expect(parseDiligenceChecklist({ items: [], updatedAt: 123 })).toEqual(emptyDiligenceChecklist());

    const parsed = parseDiligenceChecklist({
      items: { notice_read: true, capital_ready: true, unknown_key: true, repair_quoted: "yes" },
      updatedAt: "2026-11-27T12:00:00.000Z",
    });
    expect(parsed.items.notice_read).toBe(true);
    expect(parsed.items.capital_ready).toBe(true);
    expect(parsed.items.repair_quoted).toBe(false);
    expect(parsed.updatedAt).toBe("2026-11-27T12:00:00.000Z");
  });

  it("summarizeDiligence conta progresso e lista pendentes críticos", () => {
    const empty = summarizeDiligence(emptyDiligenceChecklist());
    expect(empty.completed).toBe(0);
    expect(empty.total).toBe(DILIGENCE_ITEMS.length);
    expect(empty.isComplete).toBe(false);
    expect(empty.criticalPending.map((item) => item.key)).toEqual([
      "notice_read",
      "restrictions_checked",
      "condition_assessed",
      "capital_ready",
    ]);

    const partial = parseDiligenceChecklist({
      items: {
        notice_read: true,
        restrictions_checked: true,
        condition_assessed: true,
        capital_ready: true,
      },
    });
    const partialSummary = summarizeDiligence(partial);
    expect(partialSummary.completed).toBe(4);
    expect(partialSummary.criticalPending).toEqual([]);
    expect(partialSummary.isComplete).toBe(false);
  });

  it("plateLookupLinks valida placa antiga ou Mercosul e ignora entradas inválidas", () => {
    expect(plateLookupLinks(null)).toEqual([]);
    expect(plateLookupLinks("INVALIDA")).toEqual([]);

    const mercosul = plateLookupLinks("abc-1d23");
    expect(mercosul).toHaveLength(2);
    expect(mercosul[0]?.label).toContain("ABC1D23");

    const oldPlate = plateLookupLinks("XYZ9876");
    expect(oldPlate).toHaveLength(2);
    expect(oldPlate[0]?.label).toContain("XYZ9876");
  });
});
