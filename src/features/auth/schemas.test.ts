import { describe, expect, it } from "vitest";

import { DEFAULT_AFTER_LOGIN, loginInputSchema, nextPathSchema } from "./schemas";

describe("nextPathSchema", () => {
  it.each(["/dashboard", "/lotes/123?aba=fotos", "/leiloes"])("aceita caminho interno %s", (path) => {
    expect(nextPathSchema.parse(path)).toBe(path);
  });

  it.each(["https://evil.example", "//evil.example/x", "/\\evil.example", "javascript:alert(1)", "dashboard"])(
    "troca destino externo ou inválido %s pelo padrão",
    (path) => {
      expect(nextPathSchema.parse(path)).toBe(DEFAULT_AFTER_LOGIN);
    },
  );
});

describe("loginInputSchema", () => {
  it("normaliza o e-mail e usa o destino padrão", () => {
    expect(loginInputSchema.parse({ email: " Pessoa@Exemplo.com ", password: "x" })).toEqual({
      email: "pessoa@exemplo.com",
      password: "x",
      next: DEFAULT_AFTER_LOGIN,
    });
  });
});
