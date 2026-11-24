import { describe, expect, it } from "vitest";

import { bps, cents } from "@/domain/money";

import { municipalitySearchSchema, userPreferencesInputSchema } from "./schemas";

describe("userPreferencesInputSchema", () => {
  it("campos vazios viram null para manter o padrão do sistema", () => {
    const parsed = userPreferencesInputSchema.safeParse({
      municipalityIbgeCode: "",
      radiusKm: "",
      desiredMarginRateBps: "",
      riskReserveRateBps: "",
      documentationCost: "",
      towBase: "",
      towPerKm: "",
      towUnknownDistance: "",
      saleDiscountNoneBps: "",
      saleDiscountSmallBps: "",
      saleDiscountMediumBps: "",
      saleDiscountLargeBps: "",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({
      municipalityIbgeCode: null,
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
    });
  });

  it("converte percentuais pt-BR em bps e valores em reais em centavos", () => {
    const parsed = userPreferencesInputSchema.safeParse({
      municipalityIbgeCode: "3509502",
      radiusKm: "250",
      desiredMarginRateBps: "18,5",
      riskReserveRateBps: "6%",
      documentationCost: "1.850,00",
      towBase: "350",
      towPerKm: "7,50",
      towUnknownDistance: "1.800,00",
      saleDiscountNoneBps: "12",
      saleDiscountSmallBps: "22,5",
      saleDiscountMediumBps: "32",
      saleDiscountLargeBps: "45",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({
      municipalityIbgeCode: 3509502,
      radiusKm: 250,
      desiredMarginRateBps: bps(1_850),
      riskReserveRateBps: bps(600),
      documentationCost: cents(185_000),
      towBase: cents(35_000),
      towPerKm: cents(750),
      towUnknownDistance: cents(180_000),
      saleDiscountNoneBps: bps(1_200),
      saleDiscountSmallBps: bps(2_250),
      saleDiscountMediumBps: bps(3_200),
      saleDiscountLargeBps: bps(4_500),
    });
  });

  it("rejeita raio, percentuais, IBGE e valores monetários fora dos limites seguros", () => {
    const parsed = userPreferencesInputSchema.safeParse({
      municipalityIbgeCode: "123",
      radiusKm: "5",
      desiredMarginRateBps: "95",
      riskReserveRateBps: "60",
      documentationCost: "-100",
      towBase: "abc",
      towPerKm: "",
      towUnknownDistance: "",
      saleDiscountNoneBps: "99",
      saleDiscountSmallBps: "",
      saleDiscountMediumBps: "",
      saleDiscountLargeBps: "",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const fields = parsed.error.flatten().fieldErrors;
    expect(fields.municipalityIbgeCode).toBeDefined();
    expect(fields.radiusKm).toBeDefined();
    expect(fields.desiredMarginRateBps).toBeDefined();
    expect(fields.riskReserveRateBps).toBeDefined();
    expect(fields.documentationCost).toBeDefined();
    expect(fields.towBase).toBeDefined();
    expect(fields.saleDiscountNoneBps).toBeDefined();
  });
});

describe("municipalitySearchSchema", () => {
  it("exige ao menos 2 caracteres e remove espaços nas bordas", () => {
    expect(municipalitySearchSchema.safeParse("a").success).toBe(false);
    expect(municipalitySearchSchema.safeParse("   ").success).toBe(false);
    const ok = municipalitySearchSchema.safeParse("  Campinas  ");
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toBe("Campinas");
  });
});
