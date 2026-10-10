import { describe, expect, it } from "vitest";

import { cents } from "../money";
import {
  chooseFipeModels,
  fipeFuelCodes,
  type FipeOption,
  fipeReferenceMonth,
  fipeVehicleIdentity,
  fipeVehicleTypes,
  marketValueOnSave,
  MATCHER_CHANGES,
  MATCHER_VERSION,
  matchFipeBrand,
  MAX_FAMILY_CANDIDATES,
  needsRematch,
  parseFipeMonth,
  pickFipeTable,
  rematchAllBelow,
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

  describe("segunda leitura, quando a primeira não acha candidata (rótulos reais da FIPE)", () => {
    const yamaha = options([
      "YBR 125 FACTOR E",
      "YBR 125 FACTOR ED/FACTOR EDITION",
      "YBR 125 FACTOR K/ FACTOR K1",
      "YS 250 FAZER/ FAZER L. EDITION /BLUEFLEX",
      "XTZ 250 LANDER 249cc/LANDER BLUEFLEX/ABS",
    ]);
    const version = (model: string, list: readonly FipeOption[]) => {
      const choice = chooseFipeModels(model, list);
      return choice.kind === "version" ? labelOf(list, choice.code) : choice.kind;
    };

    it("ordem trocada: o modelo da FIPE entre as palavras do anúncio, ou o do anúncio entre as da FIPE", () => {
      expect(version("FACTOR YBR125 K", yamaha)).toBe("YBR 125 FACTOR K/ FACTOR K1");
      expect(version("FACTOR YBR125 ED", yamaha)).toBe("YBR 125 FACTOR ED/FACTOR EDITION");
      expect(version("LANDER XTZ250", yamaha)).toBe("XTZ 250 LANDER 249cc/LANDER BLUEFLEX/ABS");
      expect(version("FAZER250 BLUEFLEX", yamaha)).toBe("YS 250 FAZER/ FAZER L. EDITION /BLUEFLEX");
    });

    it("letras coladas no número e hífen: CB250F, C100, S1000", () => {
      const honda = options(["CB 250 TWISTER/FLEXONE", "CB 300F Twister Flex", "C 100 BIZ-ES", "C 100 DREAM"]);
      expect(version("CB250F TWISTER CBS", honda)).toBe("CB 250 TWISTER/FLEXONE");
      expect(version("C100 BIZ ES", honda)).toBe("C 100 BIZ-ES");
      expect(version("S1000 R", options(["S 1000 R", "S 1000 RR", "R 1250 GS"]))).toBe("S 1000 R");
    });

    it("'NOVO VOYAGE' é Voyage", () => {
      const vw = options(["VOYAGE 1.6/1.6 City  Mi Total Flex 8V 4p", "VOYAGE 1.0/1.0 City Mi Total Flex 8V 4p"]);
      expect(version("NOVO VOYAGE 1.6 CITY", vw)).toBe("VOYAGE 1.6/1.6 City  Mi Total Flex 8V 4p");
    });

    it("modelo de uma letra só com número em comum: o 'F' de '13F' não é F-250; C4 não puxa C3", () => {
      const ford = options(["F-250 Tropical SL/ Van T.Diesel (todas)", "F-1000 XL 3.9 Diesel"]);
      expect(chooseFipeModels("RANGER XLS 13F", ford)).toEqual({ kind: "none", reason: "no_candidates" });
      const citroen = options(["C3 Excl. 1.6 VTi Flex Start 16V 5p Aut.", "C4 LOUNGE Exclusive 1.6 Turbo Flex Aut."]);
      expect(version("C4L THP A EXCL", citroen)).toBe("C4 LOUNGE Exclusive 1.6 Turbo Flex Aut.");
    });
  });

  it("família grande vale (até MAX_FAMILY_CANDIDATES); a dispersão de preço decide depois", () => {
    const many = options(Array.from({ length: 12 }, (_, index) => `Gol 1.0 Versão${index}`));
    expect(chooseFipeModels("GOL 1.0", many)).toMatchObject({ kind: "family" });
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

describe("correlação (D-49)", () => {
  const vehicle = {
    brand: "vw",
    model: "Gol  1.0 ",
    modelYear: 2012,
    fuel: "Álcool/Gasolina",
    category: "Carros" as const,
  };

  it("chave normaliza a grafia e o combustível", () => {
    expect(fipeVehicleIdentity(vehicle)).toEqual({
      key: "VW|GOL 1.0|2012|flex|Carros",
      brand: "VW",
      model: "GOL 1.0",
      modelYear: 2012,
      fuel: "flex",
      category: "Carros",
    });
    expect(fipeVehicleIdentity({ ...vehicle, model: "GOL 1.0", fuel: "FLEX" })?.key).toBe(
      "VW|GOL 1.0|2012|flex|Carros",
    );
  });

  it("sem marca, ano ou categoria de veículo não há chave", () => {
    expect(fipeVehicleIdentity({ ...vehicle, brand: null })).toBeNull();
    expect(fipeVehicleIdentity({ ...vehicle, modelYear: null })).toBeNull();
    expect(fipeVehicleIdentity({ ...vehicle, category: "Equipamentos" })).toBeNull();
  });

  it("refaz só a automática de regra antiga que a versão nova pode mudar", () => {
    const all = rematchAllBelow();
    expect(needsRematch({ origin: "auto", matcherVersion: MATCHER_VERSION - 1, kind: "none" })).toBe(true);
    expect(needsRematch({ origin: "auto", matcherVersion: all - 1, kind: "version" })).toBe(true);
    expect(needsRematch({ origin: "auto", matcherVersion: MATCHER_VERSION, kind: "none" })).toBe(false);
    expect(needsRematch({ origin: "manual", matcherVersion: 0, kind: "none" })).toBe(false);
  });

  it("versão que só amplia a busca não refaz quem já casou", () => {
    expect(MATCHER_CHANGES[MATCHER_VERSION]).toBe("unmatched");
    expect(needsRematch({ origin: "auto", matcherVersion: MATCHER_VERSION - 1, kind: "family" })).toBe(false);
  });

  it("toda versão da regra diz o que muda", () => {
    const versions = Array.from({ length: MATCHER_VERSION }, (_, index) => index + 1);
    expect(versions.every((version) => MATCHER_CHANGES[version] !== undefined)).toBe(true);
  });
});
