import { describe, expect, it } from "vitest";

import { apiEvaluateMarketQuerySchema, apiImportLotSchema, confirmImportFormSchema } from "./import-schemas";

describe("apiImportLotSchema", () => {
  const basePayload = {
    auctioneer: "Copart Brasil",
    lotNumber: "984512",
    brand: "TOYOTA",
    model: "COROLLA",
    modelYear: 2022,
  };

  it("aceita payload válido com URL https", () => {
    const parsed = apiImportLotSchema.safeParse({
      ...basePayload,
      lotUrl: "https://www.copart.com.br/lot/984512",
      state: "sp",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.state).toBe("SP");
  });

  it("rejeita lotUrl com protocolo inseguro (javascript:, data:, file:)", () => {
    expect(apiImportLotSchema.safeParse({ ...basePayload, lotUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(apiImportLotSchema.safeParse({ ...basePayload, lotUrl: "data:text/html,<script>" }).success).toBe(false);
    expect(apiImportLotSchema.safeParse({ ...basePayload, lotUrl: "file:///etc/passwd" }).success).toBe(false);
  });
});

describe("confirmImportFormSchema", () => {
  it("valida fipeRefMonth no formato YYYY-MM", () => {
    const base = {
      auctioneer: "Copart",
      auctionName: "Copart SP",
      lotNumber: "101",
      brand: "FIAT",
      model: "ARGO",
      modelYear: "2022",
    };
    expect(confirmImportFormSchema.safeParse({ ...base, fipeRefMonth: "2026-11" }).success).toBe(true);
    expect(confirmImportFormSchema.safeParse({ ...base, fipeRefMonth: "2026-99-01" }).success).toBe(false);
  });
});

describe("apiEvaluateMarketQuerySchema", () => {
  it("coage year/mileageKm/fipeCents e rejeita entradas fora da faixa", () => {
    const ok = apiEvaluateMarketQuerySchema.safeParse({
      brand: "TOYOTA",
      model: "COROLLA",
      year: "2021",
      damageLevel: "medium",
      mileageKm: "50000",
      isMotorcycle: "false",
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.year).toBe(2021);
      expect(ok.data.isMotorcycle).toBe(false);
    }

    expect(apiEvaluateMarketQuerySchema.safeParse({ brand: "", model: "COROLLA", year: "2021" }).success).toBe(false);
    expect(apiEvaluateMarketQuerySchema.safeParse({ brand: "TOYOTA", model: "COROLLA", year: "1800" }).success).toBe(
      false,
    );
  });
});
