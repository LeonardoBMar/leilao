import { describe, expect, it } from "vitest";

import { parseFipeDataset } from "./fipe-dataset";

const HEADER =
  "tipo_veiculo\tcodigo_fipe\tnome_modelo\tnome_marca\tnome_combustivel\tsigla_combustivel\tano_modelo\tzero_km\t" +
  "valor_centavos\tvalor_formatado\tmes_referencia\tano_referencia";
const OCTOBER = new Date(Date.UTC(2026, 9, 1));

const file = (...rows: string[]) => [HEADER, ...rows].join("\n");

describe("parseFipeDataset", () => {
  it("lê tipo, combustível, ano e valor em centavos", () => {
    const parsed = parseFipeDataset(
      file(
        "carro\t005205-1\tGol 1.0 Mi 8V\tVW - VolksWagen\tGasolina\tg\t2008\tfalse\t1834500\tR$ 18.345,00\t10\t2026",
        "moto\t827001-0\tCG 160 FAN\tHONDA\tFlex\tf\t2020\tfalse\t1500000\tR$ 15.000,00\t10\t2026",
        "caminhão\t509001-2\tAccelo 815\tMercedes-Benz\tDiesel\td\t2015\tfalse\t9000000\tR$ 90.000,00\t10\t2026",
      ),
      OCTOBER,
    );
    expect(parsed?.prices).toEqual([
      {
        referenceMonth: OCTOBER,
        vehicleType: 1,
        fipeCode: "005205-1",
        brandName: "VW - VolksWagen",
        modelName: "Gol 1.0 Mi 8V",
        modelYear: 2008,
        fuelCode: 1,
        value: 1834500,
      },
      expect.objectContaining({ vehicleType: 2, fuelCode: 5 }),
      expect.objectContaining({ vehicleType: 3, fuelCode: 3 }),
    ]);
    expect(parsed?.skipped).toBe(0);
  });

  it("gás natural vira o código 7 e o nome entre aspas perde as aspas e os espaços", () => {
    const parsed = parseFipeDataset(
      file(
        'carro\t033214-3\t" Range R. VEL. 2.0 (Híbrido)"\tLand Rover\tHíbrido\th\t2023\tfalse\t34698800\tx\t10\t2026',
        "carro\t001001-1\tMarea 2.0 GNV\tFiat\tGás Natural\tn\t2001\tfalse\t900000\tx\t10\t2026",
      ),
      OCTOBER,
    );
    expect(parsed?.prices.map((price) => [price.modelName, price.fuelCode])).toEqual([
      ["Range R. VEL. 2.0 (Híbrido)", 6],
      ["Marea 2.0 GNV", 7],
    ]);
  });

  it("pula zero-km (sem ano-modelo) e linhas fora do formato", () => {
    const parsed = parseFipeDataset(
      file(
        "carro\t005205-1\tGol\tVW - VolksWagen\tFlex\tf\t\ttrue\t9000000\tx\t10\t2026",
        "carro\t005205-1\tGol\tVW - VolksWagen\tFlex\tz\t2020\tfalse\t9000000\tx\t10\t2026",
        "barco\t005205-1\tGol\tVW - VolksWagen\tFlex\tf\t2020\tfalse\t9000000\tx\t10\t2026",
        "carro\t005205-1\tGol\tVW - VolksWagen\tFlex\tf\t2020\tfalse\t0\tx\t10\t2026",
        "",
      ),
      OCTOBER,
    );
    expect(parsed).toEqual({ prices: [], skipped: 4, otherMonth: 0 });
  });

  it("conta as linhas de outro mês sem gravar", () => {
    const parsed = parseFipeDataset(
      file("carro\t005205-1\tGol\tVW - VolksWagen\tFlex\tf\t2020\tfalse\t9000000\tx\t9\t2026"),
      OCTOBER,
    );
    expect(parsed).toEqual({ prices: [], skipped: 0, otherMonth: 1 });
  });

  it("cabeçalho sem as colunas esperadas: formato mudou", () => {
    expect(parseFipeDataset("tipo\tcodigo\n", OCTOBER)).toBeNull();
  });
});
