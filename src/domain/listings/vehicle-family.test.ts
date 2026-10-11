import { describe, expect, it } from "vitest";

import { vehicleFamilyKey } from "./vehicle-family";

describe("vehicleFamilyKey", () => {
  it.each([
    ["CHEVROLET", "ONIX PLUS 10TAT PR2", "CHEVROLET|ONIX|PLUS"],
    ["Chevrolet", "Onix Plus", "CHEVROLET|ONIX|PLUS"],
    ["CHEVROLET", "ONIX 10MT LT2", "CHEVROLET|ONIX|"],
    ["GM", "ONIX 1.0 MT", "CHEVROLET|ONIX|"],
    ["CHEVROLET", "ONIX HATCH LT", "CHEVROLET|ONIX|"],
    ["CHEVROLET", "ONIX JOYE", "CHEVROLET|ONIX|JOY"],
    ["CHEVROLET", "ONIX JOY BLACK", "CHEVROLET|ONIX|JOY"],
    ["FIAT", "UNO MILLE FIRE", "FIAT|UNO|MILLE"],
    ["FIAT", "UNO VIVACE", "FIAT|UNO|"],
    ["FIAT", "PALIO WEEKEND ADVENTURE", "FIAT|PALIO|WEEKEND"],
    ["CHEVROLET", "CORSA SEDAN CLASSIC", "CHEVROLET|CLASSIC|SEDAN"],
    ["VW", "SAVEIRO CS TRENDLINE", "VOLKSWAGEN|SAVEIRO|CS"],
    ["CHEVROLET", "S10 LT 2.8 CD 4X4", "CHEVROLET|S10|CD"],
  ])("carro %s %s → %s", (brand, model, key) => {
    expect(vehicleFamilyKey(brand, model, "Carros")).toBe(key);
  });

  it("a família de carro só vale até três palavras depois do modelo", () => {
    expect(vehicleFamilyKey("FIAT", "UNO 1.0 FIRE FLEX MILLE", "Carros")).toBe("FIAT|UNO|");
  });

  it.each([
    ["HONDA", "CG 160 FAN", "HONDA|CG|160"],
    ["HONDA", "CG160 TITAN", "HONDA|CG|160"],
    ["HONDA", "CG-160 START", "HONDA|CG|160"],
    ["HONDA", "CG 150 TITAN KS", "HONDA|CG|150"],
    ["HONDA", "CG 125I FAN", "HONDA|CG|125"],
    ["YAMAHA", "YBR125 FACTOR", "YAMAHA|YBR|125"],
    ["YAMAHA", "FACTOR YBR125 ED", "YAMAHA|FACTOR|125"],
    ["HONDA", "CB 300R", "HONDA|CB|300"],
    ["HONDA", "NXR160 BROS ESDD", "HONDA|NXR|160"],
    ["HONDA", "BIZ", "HONDA|BIZ|"],
    // "MT-03" fica na família MT, como em vehicleKey.
    ["YAMAHA", "MT-03", "YAMAHA|MT|"],
  ])("moto %s %s → %s", (brand, model, key) => {
    expect(vehicleFamilyKey(brand, model, "Motos")).toBe(key);
  });

  it("sem marca ou modelo não há família, como em vehicleKey", () => {
    expect(vehicleFamilyKey(null, "ONIX", "Carros")).toBeNull();
    expect(vehicleFamilyKey("FIAT", "  ", "Carros")).toBeNull();
  });

  it("número que não é cilindrada não vira família de moto", () => {
    expect(vehicleFamilyKey("HONDA", "POP 2", "Motos")).toBe("HONDA|POP|");
    expect(vehicleFamilyKey("HONDA", "GOLD WING 1800", "Motos")).toBe("HONDA|GOLD|");
  });
});
