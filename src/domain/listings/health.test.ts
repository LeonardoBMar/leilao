import { describe, expect, it } from "vitest";

import { COLLECTION_LATE_AFTER_MS, collectorHealth, overallHealth, RUN_INTERRUPTED_AFTER_MS } from "./health";

const now = new Date("2026-09-27T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("collectorHealth", () => {
  it("sem nenhuma execução", () => {
    expect(collectorHealth(null, now)).toBe("never");
  });

  it("concluída há pouco: ok; há mais de 4 h: atrasada (agendamento parou)", () => {
    expect(collectorHealth({ status: "succeeded", startedAt: ago(60_000), finishedAt: ago(0) }, now)).toBe("ok");
    const old = ago(COLLECTION_LATE_AFTER_MS + 1);
    expect(collectorHealth({ status: "succeeded", startedAt: old, finishedAt: old }, now)).toBe("late");
  });

  it("em andamento há pouco: em andamento; há mais de 30 min: interrompida conta como falha", () => {
    expect(collectorHealth({ status: "running", startedAt: ago(5 * 60_000), finishedAt: null }, now)).toBe("running");
    expect(
      collectorHealth({ status: "running", startedAt: ago(RUN_INTERRUPTED_AFTER_MS + 1), finishedAt: null }, now),
    ).toBe("failed");
  });

  it("falhou: falha", () => {
    expect(collectorHealth({ status: "failed", startedAt: ago(0), finishedAt: ago(0) }, now)).toBe("failed");
  });
});

describe("overallHealth", () => {
  it("vale a pior fonte; sem execução nenhuma, nunca coletou", () => {
    expect(overallHealth(["ok", "late", "running"])).toBe("late");
    expect(overallHealth(["ok", "failed", "late"])).toBe("failed");
    expect(overallHealth(["ok", "never"])).toBe("ok");
    expect(overallHealth([])).toBe("never");
  });
});
