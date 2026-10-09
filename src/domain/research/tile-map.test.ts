import { describe, expect, it } from "vitest";

import { stateCode } from "../listings/place";
import { buildTiles, isStateCode, STATE_CODES, STATE_NAMES, TILE_GRID, TILE_LAYOUT } from "./tile-map";

describe("TILE_LAYOUT", () => {
  it("tem os 27 estados, cada um num quadrado diferente dentro da grade", () => {
    const positions = STATE_CODES.map((state) => TILE_LAYOUT[state]);
    expect(STATE_CODES).toHaveLength(27);
    expect(new Set(positions.map(({ column, row }) => `${column},${row}`)).size).toBe(27);
    for (const { column, row } of positions) {
      expect(column).toBeGreaterThanOrEqual(0);
      expect(column).toBeLessThan(TILE_GRID.columns);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(TILE_GRID.rows);
    }
  });

  it("usa as mesmas siglas que a leitura do local dos anúncios", () => {
    for (const state of STATE_CODES) expect(stateCode(STATE_NAMES[state])).toBe(state);
  });
});

describe("isStateCode", () => {
  it("aceita só siglas válidas, em maiúsculas", () => {
    expect(isStateCode("SP")).toBe(true);
    expect(isStateCode("sp")).toBe(false);
    expect(isStateCode("XX")).toBe(false);
  });
});

describe("buildTiles", () => {
  it("cada estado com o seu resumo; ausente fica sem venda", () => {
    const tiles = buildTiles({
      SP: { n: 297, p25: 0.36, median: 0.43, p75: 0.5 },
      MT: { n: 2, p25: 0.4, median: 0.41, p75: 0.42 },
    });
    expect(tiles).toHaveLength(27);
    expect(tiles.find((tile) => tile.state === "SP")).toEqual({
      state: "SP",
      column: 2,
      row: 4,
      summary: { kind: "summary", n: 297, low: 0.36, median: 0.43, high: 0.5 },
    });
    expect(tiles.find((tile) => tile.state === "MT")?.summary).toEqual({ kind: "few", n: 2 });
    expect(tiles.find((tile) => tile.state === "AC")?.summary).toEqual({ kind: "none" });
  });
});
