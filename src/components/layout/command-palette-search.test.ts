import { describe, expect, it } from "vitest";

import { matchesCommandQuery, normalizeCommandText } from "./command-palette-search";

describe("command-palette-search", () => {
  it("normaliza acentos, maiúsculas e espaços extras", () => {
    expect(normalizeCommandText("  Leilões & Calibração — Avaliação  ")).toBe("leiloes & calibracao — avaliacao");
    expect(normalizeCommandText("Ações / Análises")).toBe("acoes / analises");
  });

  it("casa consultas com ou sem acento em qualquer campo", () => {
    expect(matchesCommandQuery(["Mercado — Calibração", "backtest acertos"], normalizeCommandText("calibracao"))).toBe(
      true,
    );
    expect(matchesCommandQuery(["Mercado — Avaliar modelo"], normalizeCommandText("avalia"))).toBe(true);
    expect(matchesCommandQuery(["Leilões do catálogo"], normalizeCommandText("leiloes"))).toBe(true);
    expect(matchesCommandQuery(["Leilões do catálogo"], normalizeCommandText("leilões"))).toBe(true);
  });

  it("exige todas as palavras em consultas compostas, em qualquer ordem", () => {
    const fields = ["Honda Civic 2020", "Lote 042 · Leilão Detran SP"];
    expect(matchesCommandQuery(fields, normalizeCommandText("civic 2020"))).toBe(true);
    expect(matchesCommandQuery(fields, normalizeCommandText("042 detran"))).toBe(true);
    expect(matchesCommandQuery(fields, normalizeCommandText("civic corolla"))).toBe(false);
  });
});
