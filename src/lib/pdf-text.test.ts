import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { extractPdfText } from "./pdf-text";

describe("extractPdfText", () => {
  it("extrai texto de stream sem compressão (Tj e TJ)", () => {
    const pdf = Buffer.from(
      "%PDF-1.4\n1 0 obj << /Length 80 >>\nstream\nBT (Comissao do leiloeiro de 5%) Tj [(Taxa administrativa ) -10 (R$ 1.850,00)] TJ ET\nendstream\nendobj\n%%EOF",
      "latin1",
    );
    const text = extractPdfText(pdf);
    expect(text).toContain("Comissao do leiloeiro de 5%");
    expect(text).toContain("Taxa administrativa R$ 1.850,00");
  });

  it("extrai texto de stream comprimido com FlateDecode", () => {
    const content = Buffer.from("BT (Debitos de IPVA por conta do arrematante) Tj ET", "latin1");
    const compressed = deflateSync(content);
    const pdf = Buffer.concat([
      Buffer.from("%PDF-1.4\n1 0 obj << /Filter /FlateDecode >>\nstream\n", "latin1"),
      compressed,
      Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
    ]);
    expect(extractPdfText(pdf)).toContain("Debitos de IPVA por conta do arrematante");
  });

  it("retorna vazio para arquivo que não é PDF", () => {
    expect(extractPdfText(Buffer.from("apenas texto comum"))).toBe("");
    expect(extractPdfText(Buffer.alloc(0))).toBe("");
  });

  it("decodifica hex UTF-16BE, escapes octais e resiste a entradas sem fechamento (sem ReDoS)", () => {
    // UTF-16BE BOM (FEFF) + "IPVA" (0049 0050 0056 0041) e octal \050 = '('
    const pdf = Buffer.from(
      "%PDF-1.4\n1 0 obj << >>\nstream\nBT <FEFF0049005000560041> Tj (Multa \\050SP\\051) Tj ET\nendstream\n%%EOF",
      "latin1",
    );
    const extracted = extractPdfText(pdf);
    expect(extracted).toContain("IPVA");
    expect(extracted).toContain("Multa (SP)");

    // Entrada patológica com milhares de delimitadores sem fechamento termina em tempo linear (< 50 ms)
    const pathological = Buffer.from(
      `%PDF-1.4\nstream\n${"(".repeat(20_000)}${"[".repeat(20_000)}\nendstream`,
      "latin1",
    );
    const started = performance.now();
    expect(extractPdfText(pathological)).toBe("");
    expect(performance.now() - started).toBeLessThan(200);
  });
});
