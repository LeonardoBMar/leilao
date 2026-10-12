import { describe, expect, it } from "vitest";

/**
 * Teste com banco, só leitura: `DB_TESTS=1 npx vitest run src/server/fipe`. Confere que a lista de meses salta pela PK
 * e devolve datas, do mais novo ao mais antigo.
 */
describe.skipIf(process.env.DB_TESTS !== "1")("meses do catálogo FIPE", () => {
  it("lista os meses importados em ordem decrescente", async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env.local");
    const { importedMonths } = await import("./catalog");
    const { db } = await import("../db");

    const months = await importedMonths();
    expect(months.length).toBeGreaterThan(0);
    expect(months.every((month) => month.getUTCDate() === 1)).toBe(true);
    expect(months.map((month) => month.getTime())).toEqual(
      months.map((month) => month.getTime()).toSorted((a, b) => b - a),
    );

    await db.$disconnect();
  }, 30_000);
});
