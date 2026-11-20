import { describe, expect, it } from "vitest";

import { alertFiltersSchema, alertIdSchema } from "./schemas";

const VALID_UUID = "01950000-0000-7000-8000-000000000001";

describe("alertIdSchema", () => {
  it("aceita UUID válido e rejeita texto arbitrário", () => {
    expect(alertIdSchema.safeParse(VALID_UUID).success).toBe(true);
    expect(alertIdSchema.safeParse("invalido").success).toBe(false);
    expect(alertIdSchema.safeParse("").success).toBe(false);
  });
});

describe("alertFiltersSchema", () => {
  it("usa padrões quando vazio (não lidos, página 1, sem filtro de monitor)", () => {
    expect(alertFiltersSchema.parse({})).toEqual({
      watchId: undefined,
      unreadOnly: true,
      page: 1,
    });
  });

  it("lê filtros válidos de monitor, situação e página", () => {
    expect(
      alertFiltersSchema.parse({
        monitor: VALID_UUID,
        situacao: "todos",
        pagina: "3",
      }),
    ).toEqual({
      watchId: VALID_UUID,
      unreadOnly: false,
      page: 3,
    });
  });

  it("cai nos padrões sem lançar erro quando recebe valores inválidos", () => {
    expect(
      alertFiltersSchema.parse({
        monitor: "nao-e-uuid",
        situacao: "qualquer",
        pagina: "0",
      }),
    ).toEqual({
      watchId: undefined,
      unreadOnly: true,
      page: 1,
    });

    expect(alertFiltersSchema.parse({ pagina: "10001" }).page).toBe(1);
    expect(alertFiltersSchema.parse({ pagina: "10000" }).page).toBe(10_000);
  });
});
