import { describe, expect, it } from "vitest";

import { createPoliteFetcher } from "./http";

/** Relógio e espera falsos: `sleep` só avança o relógio e registra quanto esperou. */
function fakeClock() {
  let time = 0;
  const waits: number[] = [];
  return {
    now: () => time,
    sleep: (ms: number) => {
      waits.push(ms);
      time += ms;
      return Promise.resolve();
    },
    waits,
  };
}

function fakeFetch(responses: (Response | Error)[]) {
  const calls: { url: string; userAgent: string | null }[] = [];
  const impl: typeof fetch = (input, init) => {
    calls.push({ url: String(input), userAgent: new Headers(init?.headers).get("user-agent") });
    const next = responses.shift();
    if (!next) throw new Error("sem resposta preparada");
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  return { impl, calls };
}

describe("createPoliteFetcher", () => {
  it("identifica o coletor e respeita o intervalo mínimo entre requisições", async () => {
    const clock = fakeClock();
    const { impl, calls } = fakeFetch([new Response("a"), new Response("b")]);
    const fetcher = createPoliteFetcher({ fetchImpl: impl, sleep: clock.sleep, now: clock.now, minIntervalMs: 1_000 });

    expect(await fetcher.get("https://fonte/1")).toEqual({ ok: true, text: "a" });
    expect(await fetcher.get("https://fonte/2")).toEqual({ ok: true, text: "b" });
    expect(clock.waits).toEqual([1_000]);
    expect(calls[0]?.userAgent).toMatch(/^LeilaoTracker\//);
    expect(fetcher.requests).toBe(2);
  });

  it("tenta de novo em 503 e erro de rede, com espera crescente", async () => {
    const clock = fakeClock();
    const { impl } = fakeFetch([new Response("", { status: 503 }), new Error("ECONNRESET"), new Response("ok")]);
    const fetcher = createPoliteFetcher({ fetchImpl: impl, sleep: clock.sleep, now: clock.now, minIntervalMs: 0 });

    expect(await fetcher.get("https://fonte/1")).toEqual({ ok: true, text: "ok" });
    expect(clock.waits).toEqual([2_000, 4_000]);
    expect(fetcher.requests).toBe(3);
  });

  it("segue o Retry-After do 429", async () => {
    const clock = fakeClock();
    const { impl } = fakeFetch([
      new Response("", { status: 429, headers: { "retry-after": "7" } }),
      new Response("ok"),
    ]);
    const fetcher = createPoliteFetcher({ fetchImpl: impl, sleep: clock.sleep, now: clock.now, minIntervalMs: 0 });

    await fetcher.get("https://fonte/1");
    expect(clock.waits).toEqual([7_000]);
  });

  it("404 volta na hora, sem nova tentativa", async () => {
    const clock = fakeClock();
    const { impl } = fakeFetch([new Response("", { status: 404 })]);
    const fetcher = createPoliteFetcher({ fetchImpl: impl, sleep: clock.sleep, now: clock.now });

    expect(await fetcher.get("https://fonte/1")).toEqual({ ok: false, status: 404, error: "HTTP 404" });
    expect(fetcher.requests).toBe(1);
  });

  it("desiste depois do número máximo de tentativas", async () => {
    const clock = fakeClock();
    const { impl } = fakeFetch([new Response("", { status: 500 }), new Response("", { status: 500 })]);
    const fetcher = createPoliteFetcher({
      fetchImpl: impl,
      sleep: clock.sleep,
      now: clock.now,
      minIntervalMs: 0,
      maxAttempts: 2,
    });

    expect(await fetcher.get("https://fonte/1")).toEqual({ ok: false, status: 500, error: "HTTP 500" });
  });
});
