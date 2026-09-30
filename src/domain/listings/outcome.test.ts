import { describe, expect, it } from "vitest";

import { cents } from "../money";
import { hasEnded, listingOutcome, type OutcomeListing } from "./outcome";

const now = new Date("2026-10-01T12:00:00Z");
const ended = new Date("2026-09-30T15:29:20Z");
const future = new Date("2026-10-02T12:00:00Z");

const listing = (overrides: Partial<OutcomeListing> = {}): OutcomeListing => ({
  status: "open",
  currentBid: cents(2_390_000),
  finalBid: null,
  endsAt: ended,
  checking: true,
  ...overrides,
});

describe("listingOutcome", () => {
  it("vendido: resultado com o lance final e a hora do fim", () => {
    expect(listingOutcome(listing({ status: "sold", finalBid: cents(2_500_000) }), now)).toEqual({
      kind: "final",
      outcome: "sold",
      finalBid: 2_500_000,
      eventAt: ended,
    });
  });

  it("vendido sem lance final gravado: usa o último lance visto", () => {
    expect(listingOutcome(listing({ status: "sold" }), now)).toMatchObject({ kind: "final", finalBid: 2_390_000 });
  });

  it("lance zero no catálogo não vira preço final", () => {
    expect(listingOutcome(listing({ status: "sold", finalBid: cents(0), currentBid: cents(0) }), now)).toMatchObject({
      kind: "final",
      finalBid: null,
    });
    expect(listingOutcome(listing({ status: "sold", finalBid: cents(0) }), now)).toMatchObject({ finalBid: 2_390_000 });
  });

  it("não vendido ou retirado: resultado sem preço", () => {
    expect(listingOutcome(listing({ status: "unsold" }), now)).toEqual({
      kind: "final",
      outcome: "unsold",
      finalBid: null,
      eventAt: ended,
    });
    expect(listingOutcome(listing({ status: "withdrawn" }), now)).toMatchObject({ outcome: "withdrawn" });
  });

  it("condicional ou desconhecido: a confirmar, com o último lance", () => {
    expect(listingOutcome(listing({ status: "conditional" }), now)).toEqual({
      kind: "to_confirm",
      reason: "conditional",
      lastBid: 2_390_000,
      eventAt: ended,
    });
    expect(listingOutcome(listing({ status: "unknown", currentBid: null }), now)).toMatchObject({
      reason: "unknown",
      lastBid: null,
    });
  });

  it("aberto: espera, inclusive depois do fim enquanto o coletor revisita", () => {
    expect(listingOutcome(listing({ endsAt: future }), now)).toEqual({ kind: "pending" });
    expect(listingOutcome(listing(), now)).toEqual({ kind: "pending" });
  });

  it("aberto depois do fim e sem revisita marcada: o coletor desistiu, fica a confirmar", () => {
    expect(listingOutcome(listing({ checking: false }), now)).toMatchObject({ kind: "to_confirm", reason: "unknown" });
    expect(listingOutcome(listing({ checking: false, endsAt: future }), now)).toEqual({ kind: "pending" });
    expect(listingOutcome(listing({ checking: false, endsAt: null }), now)).toMatchObject({ kind: "to_confirm" });
  });

  it("fim no futuro nunca vira hora do desfecho", () => {
    expect(listingOutcome(listing({ status: "unknown", endsAt: future }), now)).toMatchObject({ eventAt: null });
  });
});

describe("hasEnded", () => {
  it("encerrado por desfecho ou pelo horário", () => {
    expect(hasEnded({ status: "sold", endsAt: future }, now)).toBe(true);
    expect(hasEnded({ status: "open", endsAt: ended }, now)).toBe(true);
    expect(hasEnded({ status: "open", endsAt: future }, now)).toBe(false);
    expect(hasEnded({ status: "open", endsAt: null }, now)).toBe(false);
  });
});
