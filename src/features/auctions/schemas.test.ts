import { describe, expect, it } from "vitest";
import { z } from "zod";

import { auctionFiltersSchema, auctionInputSchema, periodRange } from "./schemas";

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

describe("auctionFiltersSchema", () => {
  it("usa padrões quando a URL não tem filtros", () => {
    expect(auctionFiltersSchema.parse({})).toEqual({
      search: undefined,
      origin: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
      sort: "asc",
      archived: false,
      page: 1,
    });
  });

  it("nunca lança: valores inválidos viram o padrão", () => {
    expect(
      auctionFiltersSchema.parse({
        origem: "marte",
        status: "x",
        de: "ontem",
        ordem: "aleatoria",
        arquivados: "sim",
        pagina: "-3",
      }),
    ).toMatchObject({ origin: undefined, status: undefined, from: undefined, sort: "asc", archived: false, page: 1 });
  });

  it("lê filtros válidos", () => {
    expect(
      auctionFiltersSchema.parse({
        busca: " detran ",
        origem: "judicial",
        ordem: "desc",
        arquivados: "1",
        pagina: "3",
      }),
    ).toMatchObject({ search: "detran", origin: "judicial", sort: "desc", archived: true, page: 3 });
  });
});

describe("periodRange", () => {
  it("cobre os dias inteiros de início e fim no horário de Brasília", () => {
    expect(periodRange({ from: "2026-10-01", to: "2026-10-31" })).toEqual({
      gte: new Date("2026-10-01T03:00:00.000Z"),
      lt: new Date("2026-11-01T03:00:00.000Z"),
    });
    expect(periodRange({ from: undefined, to: undefined })).toEqual({});
  });
});
