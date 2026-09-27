import { describe, expect, it } from "vitest";
import { z } from "zod";

import { currentBidInputSchema, lotFiltersSchema, lotInputSchema } from "./schemas";

const validForm = {
  lotNumber: "  0152 ",
  brand: "Toyota",
  model: "Corolla",
  vehicleVersion: "",
  modelYear: "2020",
  manufactureYear: "2019",
  mileageKm: "",
  startingBid: "25.000,00",
  currentBid: "",
  lotUrl: "",
  isFollowed: "on",
  notes: "",
};

function fieldErrors(input: Record<string, string>) {
  const result = lotInputSchema.safeParse(input);
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
}

describe("lotInputSchema", () => {
  it("normaliza o formulário (RF-02)", () => {
    expect(lotInputSchema.parse(validForm)).toEqual({
      lotNumber: "0152",
      brand: "Toyota",
      model: "Corolla",
      vehicleVersion: undefined,
      modelYear: 2020,
      manufactureYear: 2019,
      mileageKm: undefined,
      startingBid: 2_500_000,
      currentBid: undefined,
      lotUrl: undefined,
      isFollowed: true,
      notes: undefined,
    });
  });

  it("mantém o número do lote como texto, preservando zeros e sufixos", () => {
    expect(lotInputSchema.parse({ ...validForm, lotNumber: "152-A" }).lotNumber).toBe("152-A");
  });

  it("distingue quilometragem desconhecida (vazio) de zero informado", () => {
    expect(lotInputSchema.parse({ ...validForm, mileageKm: "" }).mileageKm).toBeUndefined();
    expect(lotInputSchema.parse({ ...validForm, mileageKm: "0" }).mileageKm).toBe(0);
    expect(lotInputSchema.parse({ ...validForm, mileageKm: "87.500" }).mileageKm).toBe(87_500);
  });

  it("checkbox ausente significa não acompanhar", () => {
    const { isFollowed: _omit, ...withoutCheckbox } = validForm;
    expect(lotInputSchema.parse(withoutCheckbox).isFollowed).toBe(false);
  });

  it("rejeita ano de fabricação posterior ao ano-modelo", () => {
    expect(fieldErrors({ ...validForm, manufactureYear: "2021" })).toEqual({
      manufactureYear: ["O ano de fabricação não pode ser posterior ao ano-modelo."],
    });
  });

  it("exige lances positivos (SPEC §7.6) e campos obrigatórios", () => {
    expect(Object.keys(fieldErrors({ ...validForm, lotNumber: " ", modelYear: "", currentBid: "0" })).sort()).toEqual([
      "currentBid",
      "lotNumber",
      "modelYear",
    ]);
  });
});

describe("currentBidInputSchema", () => {
  it("vazio limpa; valor vira centavos", () => {
    expect(currentBidInputSchema.parse({ currentBid: "" })).toEqual({ currentBid: undefined });
    expect(currentBidInputSchema.parse({ currentBid: "38.500" })).toEqual({ currentBid: 3_850_000 });
  });
});

describe("lotFiltersSchema", () => {
  it("usa padrões e ignora valores inválidos", () => {
    expect(lotFiltersSchema.parse({ analise: "talvez", acompanhados: "sim", pagina: "0" })).toEqual({
      search: undefined,
      followedOnly: false,
      analysis: undefined,
      result: undefined,
      archived: false,
      page: 1,
    });
  });

  it("lê filtros válidos", () => {
    expect(
      lotFiltersSchema.parse({ busca: "corolla", acompanhados: "1", analise: "com", resultado: "sem" }),
    ).toMatchObject({ search: "corolla", followedOnly: true, analysis: "com", result: "sem" });
  });
});
