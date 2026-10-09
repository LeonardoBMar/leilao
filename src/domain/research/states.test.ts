import { describe, expect, it } from "vitest";

import { stateCode } from "../listings/place";
import { buildStateSummaries, isStateCode, STATE_CODES, STATE_NAMES } from "./states";

describe("STATE_CODES", () => {
  it("tem os 27 estados", () => {
    expect(new Set(STATE_CODES).size).toBe(27);
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

describe("buildStateSummaries", () => {
  it("cada estado com o seu resumo; ausente fica sem venda", () => {
    const states = buildStateSummaries({
      SP: { n: 297, p25: 0.36, median: 0.43, p75: 0.5 },
      MT: { n: 2, p25: 0.4, median: 0.41, p75: 0.42 },
    });
    expect(states).toHaveLength(27);
    expect(states.find(({ state }) => state === "SP")?.summary).toEqual({
      kind: "summary",
      n: 297,
      low: 0.36,
      median: 0.43,
      high: 0.5,
    });
    expect(states.find(({ state }) => state === "MT")?.summary).toEqual({ kind: "few", n: 2 });
    expect(states.find(({ state }) => state === "AC")?.summary).toEqual({ kind: "none" });
  });
});
