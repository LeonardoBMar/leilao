import { z } from "zod";

import { EXPENSE_CATEGORIES, POST_AUCTION_STATUSES } from "@/domain/post-auction/pnl";
import { calendarDateToUtc } from "@/lib/dates";
import { brlAmount, entityId, optionalPositiveBrlAmount, optionalText, requiredText } from "@/lib/schemas";

export const lotIdSchema = entityId();
export const expenseIdSchema = entityId();

const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

function optionalCalendarDate(message = "Informe uma data válida.") {
  return z.preprocess(
    emptyToUndefined,
    z
      .string(message)
      .transform((value, ctx) => {
        const parsed = calendarDateToUtc(value);
        if (parsed === null) {
          ctx.addIssue({ code: "custom", message });
          return z.NEVER;
        }
        return parsed;
      })
      .optional(),
  );
}

function requiredCalendarDate(message = "Informe a data da despesa.") {
  return z.string(message).transform((value, ctx) => {
    const parsed = calendarDateToUtc(value.trim());
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return parsed;
  });
}

const optionalPrivatePlate = () =>
  optionalText().pipe(
    z
      .string()
      .max(10, "Use até 10 caracteres para a placa.")
      .transform((value) => value.toUpperCase())
      .optional(),
  );

export const postAuctionFormSchema = z
  .object({
    status: z.enum(POST_AUCTION_STATUSES, "Selecione uma etapa válida."),
    paymentDueAt: optionalCalendarDate(),
    paidAt: optionalCalendarDate(),
    pickedUpAt: optionalCalendarDate(),
    docReceivedAt: optionalCalendarDate(),
    listedAt: optionalCalendarDate(),
    soldAt: optionalCalendarDate(),
    salePrice: optionalPositiveBrlAmount("Informe um preço de venda maior que zero."),
    privatePlate: optionalPrivatePlate(),
    notes: optionalText().pipe(z.string().max(5_000, "Use até 5.000 caracteres.").optional()),
  })
  .superRefine((data, ctx) => {
    if (data.status === "sold") {
      if (data.salePrice === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["salePrice"],
          message: "Informe o preço real de venda para marcar como vendido.",
        });
      }
      if (data.soldAt === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["soldAt"],
          message: "Informe a data da venda para marcar como vendido.",
        });
      }
    }
  });

export type PostAuctionForm = z.infer<typeof postAuctionFormSchema>;

export const expenseFormSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES, "Selecione uma categoria válida."),
  description: requiredText("Descreva a despesa.").pipe(z.string().max(200, "Use até 200 caracteres.")),
  amount: brlAmount("Informe um valor em reais válido.").refine(
    (value) => value > 0,
    "O valor deve ser maior que zero.",
  ),
  incurredAt: requiredCalendarDate(),
});

export type ExpenseForm = z.infer<typeof expenseFormSchema>;
