import { describe, expect, it } from "vitest";

import {
  escapeRegExp,
  extractAssignedJson,
  extractNextFlightJson,
  htmlToText,
  nonEmpty,
  parseJson,
  parseYear,
  plainUpper,
  uniqueNonEmpty,
} from "./extract";

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

describe("parseJson", () => {
  it("retorna objeto para JSON válido e null para texto inválido", () => {
    expect(parseJson('{"ok":true}')).toEqual({ ok: true });
    expect(parseJson("invalido")).toBeNull();
  });
});

describe("htmlToText", () => {
  it("remove tags, decodifica entidades e colapsa espaços", () => {
    expect(htmlToText("  <p>Ve&iacute;culo   <b>com</b>&nbsp;manual</p>  ")).toBe("Veículo com manual");
  });
});

describe("nonEmpty", () => {
  it("apara espaços e converte ausente ou vazio para null", () => {
    expect(nonEmpty("  Gol  ")).toBe("Gol");
    expect(nonEmpty("   ")).toBeNull();
    expect(nonEmpty(null)).toBeNull();
    expect(nonEmpty(undefined)).toBeNull();
  });
});

describe("uniqueNonEmpty", () => {
  it("remove vazios e duplicados mantendo a primeira ocorrência", () => {
    expect(uniqueNonEmpty(["", "a", "b", "a", "", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("escapeRegExp", () => {
  it("escapa caracteres especiais de regex", () => {
    const escaped = escapeRegExp("1.0 (flex) [a+b]?");
    expect(new RegExp(`^${escaped}$`).test("1.0 (flex) [a+b]?")).toBe(true);
    expect(new RegExp(`^${escaped}$`).test("1X0 (flex) [a+b]?")).toBe(false);
  });
});

describe("plainUpper", () => {
  it("remove acentos, converte para maiúsculas e apara", () => {
    expect(plainUpper("  São José do Rio Preto  ")).toBe("SAO JOSE DO RIO PRETO");
  });
});

describe("parseYear", () => {
  it("valida anos de 4 dígitos dentro da faixa e rejeita inválidos", () => {
    expect(parseYear("2024")).toBe(2024);
    expect(parseYear(2020)).toBe(2020);
    expect(parseYear("1899")).toBeNull();
    expect(parseYear("2101")).toBeNull();
    expect(parseYear("2028", 2027)).toBeNull();
    expect(parseYear("2027", 2027)).toBe(2027);
    expect(parseYear("20")).toBeNull();
    expect(parseYear("")).toBeNull();
    expect(parseYear(null)).toBeNull();
    expect(parseYear(undefined)).toBeNull();
  });
});
