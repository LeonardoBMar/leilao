import { z } from "zod";

import { parseBRL } from "@/domain/money";

/** Campos de formulário chegam como string; estes construtores fazem a conversão de borda. */

export const requiredText = (message = "Campo obrigatório.") => z.string().trim().min(1, message);

/** Texto opcional: string vazia vira `undefined`. */
export const optionalText = () =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .optional();

/** Valor em reais digitado ("1.234,56") convertido para `Cents`. */
export const brlAmount = (message = "Informe um valor em reais válido.") =>
  z.string().transform((value, ctx) => {
    const parsed = parseBRL(value);
    if (parsed === null || parsed < 0) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return parsed;
  });

/** Valor em reais opcional: vazio vira `undefined`. */
export const optionalBrlAmount = (message?: string) =>
  z.preprocess((value) => (value === "" ? undefined : value), brlAmount(message).optional());

/** Identificador vindo de `params`, `bind` ou campo oculto. */
export const entityId = () => z.uuid("Identificador inválido.");
