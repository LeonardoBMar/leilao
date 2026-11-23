import { describe, expect, it } from "vitest";

import { activeLotFilters, clearedLotFilters } from "./filter-labels";
import { parseLotParams } from "./schemas";

describe("activeLotFilters", () => {
  it("sem filtros, sem chips", () => {
    expect(activeLotFilters(parseLotParams({}))).toEqual([]);
  });

  it("um chip por filtro, e o '×' remove só aquele", () => {
    const filters = parseLotParams({
      busca: "fox",
      posicao: "abaixo",
      leilao: "proximos",
      analise: "rascunho",
      arquivados: "1",
    });
    const chips = activeLotFilters(filters);
    expect(chips.map((chip) => chip.label)).toEqual([
      "“fox”",
      "Abaixo do limite",
      "Leilões próximos",
      "Com rascunho",
      "Só arquivados",
    ]);
    const withoutPosition = chips.find((chip) => chip.id === "posicao")?.without;
    expect(withoutPosition?.position).toBeUndefined();
    expect(withoutPosition?.search).toBe("fox");
  });
});

describe("clearedLotFilters", () => {
  it("limpa os filtros e mantém a ordem", () => {
    const cleared = clearedLotFilters(parseLotParams({ busca: "fox", acompanhados: "1", ordem: "folga" }));
    expect(activeLotFilters(cleared)).toEqual([]);
    expect(cleared.sort).toBe("folga");
  });
});
