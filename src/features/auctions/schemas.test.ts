import { describe, expect, it } from "vitest";
import { z } from "zod";

import { auctionInputSchema } from "./schemas";

const validForm = {
  name: "  Leilão Detran SP  ",
  auctioneer: "Leiloeiro Oficial",
  origin: "detran",
  status: "scheduled",
  startsAt: "2026-10-02T10:00",
  city: "",
  state: "sp",
  noticeUrl: "https://www.detran.sp.gov.br/edital.pdf",
  platformUrl: "",
  notes: "",
};

describe("auctionInputSchema", () => {
  it("normaliza o formulário para tipos de domínio", () => {
    expect(auctionInputSchema.parse(validForm)).toEqual({
      name: "Leilão Detran SP",
      auctioneer: "Leiloeiro Oficial",
      origin: "detran",
      status: "scheduled",
      startsAt: new Date("2026-10-02T13:00:00.000Z"),
      city: undefined,
      state: "SP",
      noticeUrl: "https://www.detran.sp.gov.br/edital.pdf",
      platformUrl: undefined,
      notes: undefined,
    });
  });

  it("rejeita campos obrigatórios vazios, UF inválida e link não http", () => {
    const result = auctionInputSchema.safeParse({
      ...validForm,
      name: " ",
      origin: "",
      startsAt: "2026-02-30T10:00",
      state: "XX",
      noticeUrl: "javascript:alert(1)",
    });

    expect(result.success).toBe(false);
    expect(Object.keys(z.flattenError(result.error ?? new z.ZodError([])).fieldErrors).sort()).toEqual([
      "name",
      "noticeUrl",
      "origin",
      "startsAt",
      "state",
    ]);
  });
});
