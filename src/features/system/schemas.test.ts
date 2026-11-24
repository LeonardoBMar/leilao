import { describe, expect, it } from "vitest";

import {
  collectorRunErrorsSchema,
  fipeQueueFiltersSchema,
  resetFipeMatchSchema,
  saveManualFipeMatchSchema,
  toggleSourceSchema,
} from "./schemas";

const VALID_ID = "00000000-0000-7000-8000-000000000001";

describe("system schemas", () => {
  it("valida toggleSourceSchema", () => {
    expect(toggleSourceSchema.parse({ sourceId: "leilo", active: "false" })).toEqual({
      sourceId: "leilo",
      active: false,
    });
    expect(toggleSourceSchema.safeParse({ sourceId: "", active: "true" }).success).toBe(false);
  });

  it("sanitiza collectorRunErrorsSchema para payloads inesperados", () => {
    expect(collectorRunErrorsSchema.parse([{ url: "https://a.test", error: "500" }])).toEqual([
      { url: "https://a.test", error: "500" },
    ]);
    expect(collectorRunErrorsSchema.parse("invalido")).toEqual([]);
  });

  it("aplica padrões seguros em fipeQueueFiltersSchema", () => {
    expect(fipeQueueFiltersSchema.parse({})).toEqual({
      situacao: "none",
      origem: "todas",
      busca: undefined,
      item: undefined,
      tipo: undefined,
      marca: undefined,
    });
    expect(
      fipeQueueFiltersSchema.parse({ situacao: "invalido", origem: "manual", item: "nao-uuid", tipo: "2" }),
    ).toEqual({
      situacao: "none",
      origem: "manual",
      busca: undefined,
      item: undefined,
      tipo: 2,
      marca: undefined,
    });
  });

  it("exige ao menos um código FIPE quando mode é models e aceita vazio quando none", () => {
    expect(
      saveManualFipeMatchSchema.safeParse({
        matchId: VALID_ID,
        mode: "models",
        modelCodes: [],
      }).success,
    ).toBe(false);

    expect(
      saveManualFipeMatchSchema.safeParse({
        matchId: VALID_ID,
        mode: "models",
        vehicleType: "1",
        brandCode: "VW - VolksWagen",
        modelCodes: ["005205-1"],
      }).success,
    ).toBe(true);

    expect(
      saveManualFipeMatchSchema.safeParse({
        matchId: VALID_ID,
        mode: "none",
        modelCodes: [],
      }).success,
    ).toBe(true);

    expect(
      saveManualFipeMatchSchema.safeParse({
        matchId: VALID_ID,
        mode: "models",
        modelCodes: Array.from({ length: 51 }, (_, index) => `005205-${index}`),
      }).success,
    ).toBe(false);
  });

  it("valida resetFipeMatchSchema com UUID", () => {
    expect(resetFipeMatchSchema.safeParse({ matchId: VALID_ID }).success).toBe(true);
    expect(resetFipeMatchSchema.safeParse({ matchId: "invalido" }).success).toBe(false);
  });
});
