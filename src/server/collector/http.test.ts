import { describe, expect, it } from "vitest";

import { createPoliteFetcher, DEADLINE_ERROR } from "./http";

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
  const calls: { url: string; userAgent: string | null; method: string | undefined; body: string | null }[] = [];
  const impl: typeof fetch = (input, init) => {
    calls.push({
      url: String(input),
      userAgent: new Headers(init?.headers).get("user-agent"),
      method: init?.method,
      body: init?.body instanceof URLSearchParams ? init.body.toString() : null,
    });
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

  it("`siteFailing` diz se a última resposta foi falha do site (rede, recusa, 5xx), não 404 nem página que veio", async () => {
    const clock = fakeClock();
    const { impl } = fakeFetch([
      new Response("", { status: 403 }),
      new Response("ok"),
      new Error("ETIMEDOUT"),
      new Response("", { status: 404 }),
    ]);
    const fetcher = createPoliteFetcher({
      fetchImpl: impl,
      sleep: clock.sleep,
      now: clock.now,
      minIntervalMs: 0,
      maxAttempts: 1,
    });

    expect(fetcher.siteFailing).toBe(false);
    const states = [];
    for (let index = 0; index < 4; index++) {
      await fetcher.get(`https://fonte/${index}`);
      states.push(fetcher.siteFailing);
    }
    expect(states).toEqual([true, false, true, false]);
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

  it("depois do fim do tempo da execução não faz requisição nem nova tentativa", async () => {
    const clock = fakeClock();
    const { impl, calls } = fakeFetch([new Error("fetch failed"), new Response("ok")]);
    const fetcher = createPoliteFetcher({
      fetchImpl: impl,
      sleep: clock.sleep,
      now: clock.now,
      minIntervalMs: 0,
      deadline: 1_000,
    });

    // A primeira tentativa sai; a espera de 2 s passa do fim e a segunda não sai.
    expect(await fetcher.get("https://fonte/1")).toEqual({ ok: false, status: null, error: DEADLINE_ERROR });
    expect(await fetcher.get("https://fonte/2")).toEqual({ ok: false, status: null, error: DEADLINE_ERROR });
    expect(calls).toHaveLength(1);
    expect(fetcher.requests).toBe(1);
  });

  it("POST de formulário segue o mesmo ritmo e as mesmas novas tentativas", async () => {
    const clock = fakeClock();
    const { impl, calls } = fakeFetch([new Response("a"), new Response("", { status: 503 }), new Response("{}")]);
    const fetcher = createPoliteFetcher({ fetchImpl: impl, sleep: clock.sleep, now: clock.now, minIntervalMs: 1_000 });

    await fetcher.get("https://fonte/lista");
    expect(await fetcher.post("https://fonte/consulta", { lotes: "1-2-", lote: "" })).toEqual({ ok: true, text: "{}" });
    expect(calls.map(({ method, body }) => [method, body])).toEqual([
      ["GET", null],
      ["POST", "lotes=1-2-&lote="],
      ["POST", "lotes=1-2-&lote="],
    ]);
    expect(clock.waits).toEqual([1_000, 2_000]);
    expect(fetcher.requests).toBe(3);
  });
});
