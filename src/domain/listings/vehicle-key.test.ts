import { describe, expect, it } from "vitest";

import { vehicleKey } from "./vehicle-key";

describe("vehicleKey", () => {
  it("fonte e Tracker na mesma chave: sem acento, maiúsculas, marca por extenso e modelo base", () => {
    expect(vehicleKey("CHEVROLET", "ONIX PLUS JOY BLACK")).toBe("CHEVROLET|ONIX");
    expect(vehicleKey("GM", "Onix")).toBe("CHEVROLET|ONIX");
    expect(vehicleKey("VW", "Gol 1.0")).toBe("VOLKSWAGEN|GOL");
    expect(vehicleKey("Citroën", "C3")).toBe("CITROEN|C3");
    expect(vehicleKey("MERCEDES-BENZ", "C180")).toBe(vehicleKey("Mercedes", "C 180".replace(" ", "")));
  });

  it("prefixo curto junta a palavra seguinte, com hífen ou espaço na fonte", () => {
    expect(vehicleKey("VOLKSWAGEN", "T-CROSS")).toBe("VOLKSWAGEN|T-CROSS");
    expect(vehicleKey("VW", "T CROSS 200 TSI")).toBe("VOLKSWAGEN|T-CROSS");
    expect(vehicleKey("HONDA", "HR-V EXL")).toBe("HONDA|HR-V");
    expect(vehicleKey("HONDA", "CR-V LX")).toBe("HONDA|CR-V");
    expect(vehicleKey("FORD", "F 350")).toBe("FORD|F-350");
    expect(vehicleKey("FORD", "F-150 4X4")).toBe("FORD|F-150");
    expect(vehicleKey("Mercedes-Benz", "C-180K (4P)")).toBe("MERCEDES BENZ|C-180K");
  });

  it("família com nome próprio não junta: CG 160, KA SE, MT-03, YZF R-15, HR HDB", () => {
    expect(vehicleKey("HONDA", "CG 160 FAN")).toBe("HONDA|CG");
    expect(vehicleKey("FORD", "KA SE")).toBe("FORD|KA");
    expect(vehicleKey("YAMAHA", "MT-03")).toBe("YAMAHA|MT");
    expect(vehicleKey("YAMAHA", "YZF R-15")).toBe("YAMAHA|YZF");
    expect(vehicleKey("HYUNDAI", "HR HDB")).toBe("HYUNDAI|HR");
    expect(vehicleKey("FIAT", "X")).toBe("FIAT|X");
  });

  it("Corsa Classic agrupa com o Classic, e o resto do Corsa fica no Corsa", () => {
    expect(vehicleKey("GM", "CORSA CLASSIC")).toBe("CHEVROLET|CLASSIC");
    expect(vehicleKey("CHEVROLET", "Corsa Sedan Classic Life")).toBe("CHEVROLET|CLASSIC");
    expect(vehicleKey("CHEVROLET", "CLASSIC LS")).toBe("CHEVROLET|CLASSIC");
    expect(vehicleKey("GMC", "CORSA WIND")).toBe("CHEVROLET|CORSA");
    expect(vehicleKey("FORD", "CORSA CLASSIC")).toBe("FORD|CORSA");
  });

  it("sem marca ou modelo: sem chave", () => {
    expect(vehicleKey(null, "ONIX")).toBeNull();
    expect(vehicleKey("FIAT", "  ")).toBeNull();
  });
});
