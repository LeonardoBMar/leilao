import { describe, expect, it } from "vitest";

import { changedFields } from "./changes";

describe("changedFields", () => {
  const stored = {
    title: "GOL 1.0",
    currentBidCents: 1_000_00,
    endsAt: new Date("2026-10-12T15:00:00.000Z"),
    photoUrls: ["a.jpg", "b.jpg"],
    raw: { lot: { id: 7, tags: ["x"] }, bid: 100 },
    damageLevel: null,
  };

  it("nada muda: nenhuma coluna", () => {
    expect(
      changedFields(stored, {
        title: "GOL 1.0",
        currentBidCents: 1_000_00,
        endsAt: new Date("2026-10-12T15:00:00.000Z"),
        photoUrls: ["a.jpg", "b.jpg"],
        // O jsonb devolve as chaves em outra ordem.
        raw: { bid: 100, lot: { tags: ["x"], id: 7 } },
        damageLevel: null,
      }),
    ).toEqual({});
  });

  it("devolve só o que mudou, com o valor novo", () => {
    expect(
      changedFields(stored, {
        title: "GOL 1.0",
        currentBidCents: 1_200_00,
        endsAt: new Date("2026-10-12T16:00:00.000Z"),
        photoUrls: ["b.jpg", "a.jpg"],
        raw: { lot: { id: 7, tags: ["x"] }, bid: 120 },
        damageLevel: "small",
      }),
    ).toEqual({
      currentBidCents: 1_200_00,
      endsAt: new Date("2026-10-12T16:00:00.000Z"),
      photoUrls: ["b.jpg", "a.jpg"],
      raw: { lot: { id: 7, tags: ["x"] }, bid: 120 },
      damageLevel: "small",
    });
  });

  it("nulo e ausente no JSON não se confundem", () => {
    expect(changedFields({ raw: { a: null } }, { raw: {} })).toEqual({ raw: {} });
  });
});
