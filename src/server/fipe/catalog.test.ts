import { afterAll, describe, expect, it } from "vitest";

/**
 * Teste com banco, só leitura: `npm run test:db`. Confere que a lista de meses salta pela PK
 * e devolve datas, do mais novo ao mais antigo.
 */
describe.skipIf(process.env.DB_TESTS !== "1")("meses do catálogo FIPE", () => {
  afterAll(async () => {
    const { disconnectDb } = await import("@/server/disconnect");
    await disconnectDb();
  });

  it("lista os meses importados em ordem decrescente", async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env.local");
    const { importedMonths } = await import("./catalog");

    const months = await importedMonths();
    expect(months.length).toBeGreaterThan(0);
    expect(months.every((month) => month.getUTCDate() === 1)).toBe(true);
    expect(months.map((month) => month.getTime())).toEqual(
      months.map((month) => month.getTime()).toSorted((a, b) => b - a),
    );
  }, 30_000);
});
