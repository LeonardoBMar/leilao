import { describe, expect, it } from "vitest";

import type { EstimateSale } from "../listings/estimates";
import { cents } from "../money";
import {
  DEFAULT_EVALUATE_FILTERS,
  evaluate,
  type EvaluateFilters,
  evaluationLevel,
  familyLabel,
  inCut,
  targetFilters,
} from "./evaluate";

let next = 0;
const sale = (overrides: Partial<EstimateSale> = {}): EstimateSale => ({
  id: `venda-${(next += 1)}`,
  endsAt: new Date(Date.UTC(2026, 8, 1 + (next % 28), 15)),
  fipeCode: null,
  origin: "orgao_publico",
  brand: "CHEVROLET",
  model: "ONIX LT",
  modelYear: 2020,
  mileageKm: 80_000,
  category: "Carros",
  damageLevel: null,
  finalBid: cents(3_000_000),
  marketValue: cents(6_000_000),
  ...overrides,
});

const filters = (overrides: Partial<EvaluateFilters> = {}): EvaluateFilters => ({
  ...DEFAULT_EVALUATE_FILTERS,
  vehicle: { brand: "CHEVROLET", model: "ONIX" },
  ...overrides,
});

describe("evaluationLevel e familyLabel", () => {
  it("versão antes de família antes de modelo", () => {
    expect(evaluationLevel({ family: "x", version: "004450-1" })).toBe("version");
    expect(evaluationLevel({ family: "x", version: null })).toBe("family");
    expect(evaluationLevel({ family: null, version: null })).toBe("model");
  });

  it("rótulo sem a marca e sem a parte vazia", () => {
    expect(familyLabel("CHEVROLET|ONIX|PLUS")).toBe("ONIX PLUS");
    expect(familyLabel("CHEVROLET|ONIX|")).toBe("ONIX");
    expect(familyLabel("HONDA|CG|160")).toBe("CG 160");
  });
});

describe("inCut", () => {
  it("família, versão, ano, km, condição e origem", () => {
    const plus = sale({ model: "ONIX PLUS LTZ", fipeCode: "004450-1", modelYear: 2021, mileageKm: 40_000 });
    expect(inCut(plus, filters({ family: "CHEVROLET|ONIX|PLUS" }))).toBe(true);
    expect(inCut(sale(), filters({ family: "CHEVROLET|ONIX|PLUS" }))).toBe(false);
    expect(inCut(plus, filters({ version: "004451-0" }))).toBe(false);
    expect(inCut(plus, filters({ yearFrom: 2022, yearTo: 2023 }))).toBe(false);
    expect(inCut(plus, filters({ maxKm: 50_000 }))).toBe(true);
    expect(inCut(sale({ mileageKm: null }), filters({ maxKm: 50_000 }))).toBe(false);
    expect(inCut(plus, filters({ condition: "media" }))).toBe(false);
    expect(inCut(plus, filters({ origin: "frota" }))).toBe(false);
    expect(inCut(plus, filters({ origin: "frota" }), "origin")).toBe(true);
  });
});

describe("evaluate", () => {
  it("com 5 vendas: faixa, confiança, % do mercado e período", () => {
    const sales = [2_000_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000].map((bid) => sale({ finalBid: cents(bid) }));
    const result = evaluate(sales, filters(), null);
    expect(result.level).toBe("model");
    expect(result.answer).toMatchObject({
      kind: "band",
      n: 5,
      median: 3_000_000,
      low: 2_250_000,
      high: 3_750_000,
      confidence: "medium",
      marketRatio: 0.5,
    });
    expect(result.comparables).toHaveLength(5);
  });

  it("vendas excluídas ficam na lista, marcadas, e saem da conta", () => {
    const sales = Array.from({ length: 5 }, () => sale());
    const result = evaluate(sales, filters({ excluded: [sales[0]?.id ?? ""] }), null);
    expect(result.answer).toEqual({ kind: "few", n: 4, needed: 5 });
    expect(result.excluded).toBe(1);
    expect(result.comparables.filter((item) => item.excluded)).toHaveLength(1);
  });

  it("sugere afrouxar só o que aumenta a amostra", () => {
    const sales = [
      sale({ modelYear: 2020 }),
      sale({ modelYear: 2019 }),
      sale({ modelYear: 2022 }),
      sale({ modelYear: 2020, mileageKm: null }),
      sale({ modelYear: 2020, origin: "frota" }),
    ];
    const result = evaluate(
      sales,
      filters({ yearFrom: 2020, yearTo: 2020, maxKm: 100_000, origin: "orgao_publico" }),
      null,
    );
    expect(result.answer).toMatchObject({ kind: "few", n: 1 });
    expect(result.loosen).toEqual([
      { change: "years", n: 2 },
      { change: "km", n: 2 },
      { change: "origin", n: 2 },
    ]);
  });

  it("conta famílias, versões e origens sem a própria dimensão", () => {
    const sales = [
      sale({ model: "ONIX PLUS", fipeCode: "004450-1" }),
      sale({ model: "ONIX PLUS", fipeCode: "004450-1", origin: "financiamento" }),
      sale({ model: "ONIX" }),
    ];
    const result = evaluate(sales, filters({ family: "CHEVROLET|ONIX|PLUS", origin: "financiamento" }), null);
    // Só a da origem escolhida: o Onix hatch é de órgão público.
    expect(result.families).toEqual([{ value: "CHEVROLET|ONIX|PLUS", n: 1 }]);
    expect(result.versions).toEqual([{ value: "004450-1", n: 1 }]);
    expect(result.origins).toMatchObject({ orgao_publico: 1, financiamento: 1 });
  });

  it("com lote alvo, ordena pela semelhança e diz por quê", () => {
    const far = sale({ modelYear: 2019, origin: "frota" });
    const close = sale({ modelYear: 2020, fipeCode: "004450-1" });
    const result = evaluate([far, close], filters(), {
      brand: "CHEVROLET",
      model: "ONIX LT",
      modelYear: 2020,
      mileageKm: 80_000,
      category: "Carros",
      damageLevel: null,
      fipeCode: "004450-1",
      origin: "orgao_publico",
      marketValue: null,
    });
    expect(result.comparables.map((item) => item.sale.id)).toEqual([close.id, far.id]);
    expect(result.comparables[0]?.similarity?.reasons).toContain("same_version");
  });
});

describe("targetFilters", () => {
  it("modelo base, ano ±1 e a condição do lote, como o preço provável", () => {
    const target = {
      brand: "Chevrolet",
      model: "Onix Plus LTZ",
      modelYear: 2021,
      mileageKm: null,
      category: "Carros",
      damageLevel: "medium" as const,
      fipeCode: null,
      origin: null,
      marketValue: null,
    };
    expect(targetFilters(target, "lote", ["x"])).toEqual({
      ...DEFAULT_EVALUATE_FILTERS,
      vehicle: { brand: "CHEVROLET", model: "ONIX" },
      yearFrom: 2020,
      yearTo: 2022,
      condition: "media",
      lot: "lote",
      excluded: ["x"],
    });
  });
});
