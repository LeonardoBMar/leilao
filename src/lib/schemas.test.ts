import { describe, expect, it } from "vitest";
import { z } from "zod";

import { brlAmount, optionalBrlAmount, optionalText, requiredText } from "./schemas";

const schema = z.object({
  name: requiredText(),
  notes: optionalText(),
  price: brlAmount(),
  fee: optionalBrlAmount(),
});

describe("form field schemas", () => {
  it("converte a entrada do formulário para tipos de domínio", () => {
    expect(schema.parse({ name: "  Detran SP ", notes: "", price: "1.234,56", fee: "" })).toEqual({
      name: "Detran SP",
      notes: undefined,
      price: 123456,
      fee: undefined,
    });
  });

  it("rejeita valores inválidos com mensagens em pt-BR", () => {
    const result = schema.safeParse({ name: " ", notes: "", price: "-10", fee: "abc" });

    expect(result.success).toBe(false);
    expect(z.flattenError(result.error ?? new z.ZodError([])).fieldErrors).toEqual({
      name: ["Campo obrigatório."],
      price: ["Informe um valor em reais válido."],
      fee: ["Informe um valor em reais válido."],
    });
  });
});
