import { describe, expect, it } from "vitest";

import { cents } from "../money";
import { finalBidOf, goneStatus, observationChanged, planVisits } from "./collect";

describe("goneStatus — página fora do ar (HTTP 404)", () => {
  const now = new Date("2026-09-29T12:00:00Z");
  const ended = new Date("2026-09-28T15:29:20Z");

  it("encerrado: para de revisitar; aberto vira desconhecido, desfecho conhecido fica", () => {
    expect(goneStatus({ status: "open", endsAt: ended }, now)).toBe("unknown");
    expect(goneStatus({ status: "conditional", endsAt: ended }, now)).toBe("conditional");
    expect(goneStatus({ status: "unsold", endsAt: ended }, now)).toBe("unsold");
  });

  it("ainda não encerrado ou sem data: não decide (conta como falha e tenta de novo)", () => {
    expect(goneStatus({ status: "open", endsAt: new Date("2026-09-30T12:00:00Z") }, now)).toBeNull();
    expect(goneStatus({ status: "open", endsAt: null }, now)).toBeNull();
  });
});

describe("finalBidOf", () => {
  it("aberto não tem lance final", () => {
    expect(finalBidOf({ status: "open", currentBid: cents(2_390_000) })).toBeNull();
  });

  it("encerrado com lance: o último lance é o final, qualquer que seja o desfecho", () => {
    expect(finalBidOf({ status: "sold", currentBid: cents(2_390_000) })).toBe(2_390_000);
    expect(finalBidOf({ status: "conditional", currentBid: cents(1_000_000) })).toBe(1_000_000);
  });

  it("encerrado sem lance: sem lance final", () => {
    expect(finalBidOf({ status: "unsold", currentBid: null })).toBeNull();
  });
});

describe("observationChanged", () => {
  const base = { status: "open", bidCents: 100, bidCount: 1 } as const;

  it("primeira observação sempre grava", () => {
    expect(observationChanged(null, base)).toBe(true);
  });

  it("nada mudou: não grava", () => {
    expect(observationChanged(base, { ...base })).toBe(false);
  });

  it.each([
    ["situação", { ...base, status: "sold" as const }],
    ["lance", { ...base, bidCents: 200 }],
    ["número de lances", { ...base, bidCount: 2 }],
  ])("mudou %s: grava", (_label, next) => {
    expect(observationChanged(base, next)).toBe(true);
  });
});

describe("planVisits", () => {
  const item = (id: string) => ({ externalId: id, url: `https://fonte/lote/${id}/` });

  it("revisitas vencidas primeiro, depois só os anúncios novos", () => {
    const visits = planVisits({
      due: [item("a"), item("b")],
      discovered: [item("a"), item("c"), item("d")],
      knownIds: new Set(["a", "b", "d"]),
      budget: 10,
    });
    expect(visits.map((visit) => [visit.externalId, visit.reason])).toEqual([
      ["a", "due"],
      ["b", "due"],
      ["c", "new"],
    ]);
  });

  it("respeita o limite de requisições", () => {
    const visits = planVisits({
      due: [item("a")],
      discovered: [item("b"), item("c")],
      knownIds: new Set(),
      budget: 2,
    });
    expect(visits.map((visit) => visit.externalId)).toEqual(["a", "b"]);
  });

  it("não visita o mesmo anúncio duas vezes na mesma execução", () => {
    const visits = planVisits({
      due: [item("a"), item("a")],
      discovered: [item("a")],
      knownIds: new Set(),
      budget: 10,
    });
    expect(visits).toHaveLength(1);
  });
});
