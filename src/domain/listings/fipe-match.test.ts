import { describe, expect, it } from "vitest";

import { cents } from "../money";
import {
  chooseFipeModels,
  fipeFuelCodes,
  type FipeOption,
  fipeReferenceMonth,
  fipeVehicleTypes,
  marketValueOnSave,
  matchFipeBrand,
  MAX_FAMILY_CANDIDATES,
  parseFipeMonth,
  pickFipeTable,
  settleFipeValue,
  versionTokens,
} from "./fipe-match";

const options = (labels: readonly string[]): FipeOption[] =>
  labels.map((label, index) => ({ code: `${index}`, label }));
const labelOf = (list: readonly FipeOption[], code: string) => list.find((item) => item.code === code)?.label;

/** Rótulos reais da FIPE (outubro/2026). */
const CAR_BRANDS = options([
  "Fiat",
  "GM - Chevrolet",
  "VW - VolksWagen",
  "Caoa Chery/Chery",
  "Kia Motors",
  "Mercedes-Benz",
]);
const HONDA_MOTOS_2012 = options([
  "BIZ 125 KS/ 125 KS FLEX",
  "CG 125 CARGO/ CARGO KS/125i CARGO",
  "CG 125 FAN / FAN KS / 125 i FAN",
  "CG 125 FAN ES",
  "CG 150 FAN ESDi/ 150 FAN ESDi FLEX",
  "CG 150 FAN ESi/ 150 FAN ESi FLEX",
  "NXR 150 BROS ES MIX/FLEX",
  "NXR 150 BROS ESD MIX/FLEX",
  "XRE 300/ 300 ABS/ FLEX",
]);
const GOL_1994 = options([
  "Gol 1000 (modelo antigo)",
  "Gol CLi / CL 1.8",
  "Gol CLi / CL/ Copa/ Stones 1.6",
  "Gol GLi / GL/ Atlanta 1.8",
  "Gol GTi 2.0",
  "Golf GTi 2.0",
]);

describe("matchFipeBrand", () => {
  it.each([
    ["VW", "VW - VolksWagen"],
    ["VOLKSWAGEN", "VW - VolksWagen"],
    ["GM", "GM - Chevrolet"],
    ["CHEV", "GM - Chevrolet"],
    ["I/FIAT", "Fiat"],
    ["CHERY", "Caoa Chery/Chery"],
    ["CAOACHERY", "Caoa Chery/Chery"],
    ["KIA", "Kia Motors"],
    ["M.BENZ", "Mercedes-Benz"],
  ])("%s → %s", (brand, label) => {
    expect(matchFipeBrand(brand, CAR_BRANDS)?.label).toBe(label);
  });

  it("marca que a FIPE não tem fica sem casar", () => {
    expect(matchFipeBrand("FACCHINI", CAR_BRANDS)).toBeNull();
    expect(matchFipeBrand(null, CAR_BRANDS)).toBeNull();
  });
});

describe("versionTokens", () => {
  it("cilindrada em várias grafias vira '1.x'; câmbio vira AUT/MEC; válvulas ficam", () => {
    expect(versionTokens(["GLI18", "CVT"])).toEqual(["GLI", "1.8", "AUT"]);
    expect(versionTokens(["16SE", "AT"])).toEqual(["1.6", "SE", "AUT"]);
    expect(versionTokens(["1.4AT", "LTZ"])).toEqual(["1.4", "AUT", "LTZ"]);
    expect(versionTokens(["10MT", "1000I", "14", "16V"])).toEqual(["1.0", "MEC", "1.0", "1.4", "16V"]);
    expect(versionTokens(["EXPR", "1016V"])).toEqual(["EXPR", "1.0", "16V"]);
    expect(versionTokens(["148V"])).toEqual(["1.4", "8V"]);
  });
});

describe("chooseFipeModels", () => {
  it("versão isolada no topo: CG 125 FAN KS", () => {
    const choice = chooseFipeModels("CG 125 FAN KS", HONDA_MOTOS_2012);
    expect(choice.kind === "version" && labelOf(HONDA_MOTOS_2012, choice.code)).toBe("CG 125 FAN / FAN KS / 125 i FAN");
  });

  it("modelo colado na cilindrada ('NXR150', 'CG150') casa com o da FIPE", () => {
    const bros = chooseFipeModels("NXR150 BROS ESD", HONDA_MOTOS_2012);
    expect(bros.kind === "version" && labelOf(HONDA_MOTOS_2012, bros.code)).toBe("NXR 150 BROS ESD MIX/FLEX");
    const fan = chooseFipeModels("CG150 FAN ESDI", HONDA_MOTOS_2012);
    expect(fan.kind === "version" && labelOf(HONDA_MOTOS_2012, fan.code)).toBe("CG 150 FAN ESDi/ 150 FAN ESDi FLEX");
  });

  it("cilindrada diferente não é candidata: CG 160 não casa com CG 125 nem 150", () => {
    expect(chooseFipeModels("CG 160 TITAN", HONDA_MOTOS_2012)).toEqual({ kind: "none", reason: "no_candidates" });
  });

  it("empate vira família; Golf não é Gol", () => {
    const choice = chooseFipeModels("GOL 1.8", GOL_1994);
    expect(choice.kind).toBe("family");
    if (choice.kind !== "family") return;
    expect(choice.codes.map((code) => labelOf(GOL_1994, code))).toEqual([
      "Gol CLi / CL 1.8",
      "Gol GLi / GL/ Atlanta 1.8",
    ]);
  });

  it("cilindrada colada nas válvulas não mistura 1.0 com 1.6: LOGAN EXPR 1016V", () => {
    const logan = options([
      "LOGAN Authentique Hi-Flex 1.0 16V 4p",
      "LOGAN Dynamique Hi-Flex 1.6 8V 4p",
      "LOGAN Expression Hi-Flex 1.6 8V 4p",
      "LOGAN Expres./Exp. UP Hi-Flex 1.0 16V 4p",
    ]);
    const choice = chooseFipeModels("LOGAN EXPR 1016V", logan);
    const codes = choice.kind === "version" ? [choice.code] : choice.kind === "family" ? choice.codes : [];
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.map((code) => labelOf(logan, code)).every((label) => label?.includes("1.0 16V"))).toBe(true);
  });

  it("'GOL 1000' casa com 'Gol 1000 (modelo antigo)' pela cilindrada", () => {
    const choice = chooseFipeModels("GOL 1000", GOL_1994);
    expect(choice.kind === "version" && labelOf(GOL_1994, choice.code)).toBe("Gol 1000 (modelo antigo)");
  });

  it("muitas versões sem nenhum sinal: sem valor", () => {
    const many = options(Array.from({ length: MAX_FAMILY_CANDIDATES + 1 }, (_, index) => `Gol Versão${index}`));
    expect(chooseFipeModels("GOL", many)).toEqual({ kind: "none", reason: "too_many" });
  });

  it("sem modelo ou sem candidata do mesmo modelo base", () => {
    expect(chooseFipeModels(null, GOL_1994)).toEqual({ kind: "none", reason: "no_model" });
    expect(chooseFipeModels("PALIO EX", GOL_1994)).toEqual({ kind: "none", reason: "no_candidates" });
  });
});

describe("settleFipeValue", () => {
  const value = (reais: number, fipeCode = "000000-0") => ({ value: cents(reais * 100), fipeCode });

  it("versão: o valor e o código dela", () => {
    expect(settleFipeValue({ kind: "version", code: "a" }, new Map([["a", value(21_125, "005205-1")]]))).toEqual({
      origin: "fipe_version",
      value: cents(2_112_500),
      fipeCode: "005205-1",
    });
  });

  it("família parecida: mediana redonda, sem código", () => {
    const values = new Map([
      ["a", value(20_000)],
      ["b", value(22_000)],
      ["c", value(23_050)],
    ]);
    expect(settleFipeValue({ kind: "family", codes: ["a", "b", "c"] }, values)).toEqual({
      origin: "fipe_family",
      value: cents(2_200_000),
      fipeCode: null,
    });
  });

  it("família dispersa (P75 ÷ P25 > 1,35) ou com valor faltando: sem valor", () => {
    const spread = new Map([
      ["a", value(10_000)],
      ["b", value(30_000)],
    ]);
    expect(settleFipeValue({ kind: "family", codes: ["a", "b"] }, spread)).toBeNull();
    expect(settleFipeValue({ kind: "family", codes: ["a", "z"] }, spread)).toBeNull();
    expect(settleFipeValue({ kind: "none", reason: "no_model" }, spread)).toBeNull();
  });
});

describe("tipos e combustíveis", () => {
  it("picape e caminhão tentam os dois tipos; equipamento não tenta", () => {
    expect(fipeVehicleTypes("Carros")).toEqual([1]);
    expect(fipeVehicleTypes("Motos")).toEqual([2]);
    expect(fipeVehicleTypes("Utilitarios")).toEqual([1, 3]);
    expect(fipeVehicleTypes("Pesados")).toEqual([3, 1]);
    expect(fipeVehicleTypes("Equipamentos")).toEqual([]);
    expect(fipeVehicleTypes(null)).toEqual([]);
  });

  it("combustível da fonte escolhe os códigos da FIPE", () => {
    expect(fipeFuelCodes(1, "DIESEL")).toEqual([3]);
    expect(fipeFuelCodes(1, "GASOL/ALC")).toEqual([5, 1, 2]);
    expect(fipeFuelCodes(2, "GASOLINA")).toEqual([1, 5]);
    expect(fipeFuelCodes(1, null)).toEqual([5, 1, 3]);
  });
});

describe("mês de referência", () => {
  const firstSeenAt = new Date("2026-10-03T12:00:00Z");

  it("aberto: mês da primeira coleta; encerrado: mês do fim", () => {
    expect(fipeReferenceMonth({ status: "open", endsAt: null, firstSeenAt })).toEqual(new Date("2026-10-01"));
    expect(fipeReferenceMonth({ status: "sold", endsAt: new Date("2026-04-20T15:00:00Z"), firstSeenAt })).toEqual(
      new Date("2026-04-01"),
    );
  });

  it("tabela do mês, a anterior mais próxima ou a mais antiga", () => {
    const tables = [
      { code: "338", month: new Date("2026-10-01") },
      { code: "337", month: new Date("2026-09-01") },
      { code: "300", month: new Date("2023-08-01") },
    ];
    expect(pickFipeTable(new Date("2026-09-01"), tables)?.code).toBe("337");
    expect(pickFipeTable(new Date("2026-11-01"), tables)?.code).toBe("338");
    expect(pickFipeTable(new Date("2026-01-01"), tables)?.code).toBe("300");
    expect(pickFipeTable(new Date("2020-01-01"), tables)?.code).toBe("300");
  });

  it("lê o mês como a FIPE escreve", () => {
    expect(parseFipeMonth("outubro/2026 ")).toEqual(new Date("2026-10-01"));
    expect(parseFipeMonth("março de 2025")).toEqual(new Date("2025-03-01"));
    expect(parseFipeMonth("13/2026")).toBeNull();
  });
});

describe("marketValueOnSave", () => {
  const vehicle = { brand: "VW", model: "GOL", modelYear: 2012, category: "Carros" };

  it("valor da fonte sempre vale", () => {
    expect(marketValueOnSave(null, { ...vehicle, marketValue: cents(100) })).toEqual({ kind: "source", value: 100 });
  });

  it("anúncio novo, ou fonte que deixou de informar: sem valor e pendente", () => {
    expect(marketValueOnSave(null, { ...vehicle, marketValue: null })).toEqual({ kind: "clear" });
    expect(marketValueOnSave({ ...vehicle, origin: "source" }, { ...vehicle, marketValue: null })).toEqual({
      kind: "clear",
    });
  });

  it("valor casado continua enquanto o veículo é o mesmo", () => {
    expect(marketValueOnSave({ ...vehicle, origin: "fipe_version" }, { ...vehicle, marketValue: null })).toEqual({
      kind: "keep",
    });
    expect(marketValueOnSave({ ...vehicle, origin: null }, { ...vehicle, marketValue: null })).toEqual({
      kind: "keep",
    });
    expect(
      marketValueOnSave({ ...vehicle, origin: "fipe_family" }, { ...vehicle, modelYear: 2013, marketValue: null }),
    ).toEqual({ kind: "clear" });
  });
});
