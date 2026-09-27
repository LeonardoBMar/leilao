import { describe, expect, it } from "vitest";
import { z } from "zod";

import { fieldError, fieldValue, formValues, validationError } from "./action-state";

describe("action-state", () => {
  it("devolve erros por campo e os valores digitados", () => {
    const formData = new FormData();
    formData.set("name", "");
    formData.set("$ACTION_ID_abc", "");
    const parsed = z.object({ name: z.string().min(1, "Informe o nome.") }).safeParse(Object.fromEntries(formData));
    if (parsed.success) throw new Error("esperava falha de validação");

    const state = validationError(parsed.error, formData);

    expect(fieldError(state, "name")).toBe("Informe o nome.");
    expect(fieldValue(state, "name")).toBe("");
    expect(formValues(formData)).toEqual({ name: "" });
  });
});
