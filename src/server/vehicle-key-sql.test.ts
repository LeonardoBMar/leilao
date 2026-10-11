import { describe, expect, it } from "vitest";

import { vehicleKey } from "@/domain/listings/vehicle-key";
import { Prisma } from "@/generated/prisma/client";

import { vehicleKeySql } from "./vehicle-key-sql";

/**
 * Teste com banco, só leitura (não toca em tabela): roda com `DB_TESTS=1 npx vitest run src/server`. Fora disso é
 * pulado, para o `npm run check` não depender de rede.
 */
const CASES: readonly [string | null, string | null][] = [
  ["CHEVROLET", "ONIX 10MT LT1"],
  ["Chevrolet", "Onix Plus"],
  ["VW", "gol 1.0"],
  ["GM", "Celta"],
  ["Mercedes-Benz", "C 180"],
  ["MERCEDES", "Sprinter"],
  ["Citroën", "C4 Lounge"],
  ["  fiat  ", "  Uno   Mille "],
  ["LAND ROVER", "Range Rover Evoque"],
  ["HONDA", "CG-160 FAN"],
  ["Peugeot", "207"],
  ["D'Angelo", "Ç-modelo"],
  ["TOYOTA", "Hilux\tSRV"],
  [null, "Onix"],
  ["", "Onix"],
  ["FIAT", null],
  ["FIAT", "  "],
  ["FIAT", "(4P)"],
  ["VOLKSWAGEN", "T-CROSS"],
  ["VW", "T CROSS 200 TSI"],
  ["HONDA", "HR-V EXL"],
  ["HONDA", "WR V"],
  ["FORD", "F-150 4X4"],
  ["Mercedes-Benz", "C-180K (4P)"],
  ["YAMAHA", "MT-03"],
  ["YAMAHA", "YZF R-15"],
  ["HONDA", "CG 160 FAN"],
  ["FORD", "KA SE"],
  ["HYUNDAI", "HR HDB"],
  ["FIAT", "X"],
  ["GM", "CORSA CLASSIC"],
  ["CHEVROLET", "Corsa Sedan Classic Life"],
  ["GMC", "CORSA WIND"],
  ["FORD", "CORSA CLASSIC"],
];

describe.skipIf(process.env.DB_TESTS !== "1")("vehicleKeySql", () => {
  it("agrupa como vehicleKey", async () => {
    // O Next não carrega .env.local com NODE_ENV=test; o Node carrega direto.
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env.local");
    const { db } = await import("./db");
    const values = Prisma.join(CASES.map(([brand, model]) => Prisma.sql`(${brand}::text, ${model}::text)`));
    const rows = await db.$queryRaw<{ key: string | null }[]>(
      Prisma.sql`SELECT ${vehicleKeySql(Prisma.sql`t.brand`, Prisma.sql`t.model`)} AS key FROM (VALUES ${values}) AS t(brand, model)`,
    );
    expect(rows.map((row) => row.key)).toEqual(CASES.map(([brand, model]) => vehicleKey(brand, model)));
    await db.$disconnect();
  });
});
