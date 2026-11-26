import { describe, expect, it } from "vitest";

import { expenseFormSchema, postAuctionFormSchema } from "./schemas";

describe("postAuctionFormSchema", () => {
  it("aceita atualização parcial em etapa intermediária", () => {
    const parsed = postAuctionFormSchema.parse({
      status: "in_repair",
      paymentDueAt: "2026-11-28",
      paidAt: "2026-11-27",
      pickedUpAt: "",
      docReceivedAt: "",
      listedAt: "",
      soldAt: "",
      salePrice: "",
      privatePlate: "abc1d23",
      notes: "Funilaria lateral esquerda.",
    });

    expect(parsed.status).toBe("in_repair");
    expect(parsed.privatePlate).toBe("ABC1D23");
    expect(parsed.paymentDueAt?.toISOString()).toBe("2026-11-28T00:00:00.000Z");
    expect(parsed.salePrice).toBeUndefined();
  });

  it("exige preço e data de venda ao marcar como vendido", () => {
    const invalid = postAuctionFormSchema.safeParse({ status: "sold", salePrice: "", soldAt: "" });
    expect(invalid.success).toBe(false);

    const valid = postAuctionFormSchema.parse({
      status: "sold",
      salePrice: "52.500,00",
      soldAt: "2026-11-20",
    });
    expect(valid.salePrice).toBe(5_250_000);
    expect(valid.soldAt?.toISOString()).toBe("2026-11-20T00:00:00.000Z");
  });
});

describe("expenseFormSchema", () => {
  it("valida despesa positiva com data de calendário", () => {
    const parsed = expenseFormSchema.parse({
      category: "repair",
      description: "Troca de para-choque dianteiro",
      amount: "1.450,50",
      incurredAt: "2026-11-18",
    });
    expect(parsed).toEqual({
      category: "repair",
      description: "Troca de para-choque dianteiro",
      amount: 145_050,
      incurredAt: new Date("2026-11-18T00:00:00.000Z"),
    });
  });

  it("rejeita valor zerado, descrição vazia ou data inválida", () => {
    expect(
      expenseFormSchema.safeParse({
        category: "repair",
        description: "  ",
        amount: "0",
        incurredAt: "2026-02-30",
      }).success,
    ).toBe(false);
  });
});
