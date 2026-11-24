import { describe, expect, it } from "vitest";

import { extractAssignedJson, extractNextFlightJson } from "./extract";

describe("extractAssignedJson", () => {
  it("extrai JSON padrão atribuído a um marcador", () => {
    const html = `<script>window.__INITIAL_STATE__={"a":1,"b":"ok"};</script>`;
    expect(extractAssignedJson(html, "window.__INITIAL_STATE__")).toEqual({ a: 1, b: "ok" });
  });

  it("normaliza literais JS de SSR (undefined, new Date, NaN, Infinity) sem alterar strings", () => {
    const html = `<script>window.__INITIAL_STATE__={"a":undefined,"d":new Date("2026-09-09T22:47:30.000Z"),"n":NaN,"inf":Infinity,"txt":"keep undefined and new Date(\\"x\\")"};</script>`;
    expect(extractAssignedJson(html, "window.__INITIAL_STATE__")).toEqual({
      a: null,
      d: "2026-09-09T22:47:30.000Z",
      n: null,
      inf: null,
      txt: 'keep undefined and new Date("x")',
    });
  });
});

describe("extractNextFlightJson", () => {
  it("decodifica chunks self.__next_f.push e extrai objeto ou array pela chave", () => {
    const payload = JSON.stringify('1:["$","div",null,{"initialLote":{"id":"1628","itens":[1,2]}}]');
    const html = `<script>self.__next_f.push([1,${payload}])</script>`;
    expect(extractNextFlightJson(html, "initialLote")).toEqual({ id: "1628", itens: [1, 2] });
    expect(extractNextFlightJson(html, "itens")).toEqual([1, 2]);
    expect(extractNextFlightJson(html, "ausente")).toBeNull();
  });
});
