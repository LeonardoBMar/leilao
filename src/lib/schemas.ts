import { z } from "zod";

import { MAX_CENTS, parseBRL } from "@/domain/money";

import { zonedDateTimeToUtc } from "./dates";

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
    if (parsed === null || parsed < 0 || parsed > MAX_CENTS) {
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

/** URL opcional, somente http/https (SPEC §11: links de leilão abrem com segurança). */
export const optionalUrl = (message = "Informe um link começando com http:// ou https://.") =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .url({ protocol: /^https?$/, hostname: z.regexes.domain, error: message })
      .trim()
      .optional(),
  );

/** Data e hora de `datetime-local`, interpretada no fuso do app e convertida para UTC. */
export const zonedDateTime = (message = "Informe data e hora válidas.") =>
  z.string().transform((value, ctx) => {
    const date = zonedDateTimeToUtc(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return date;
  });

const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

/** Inteiro digitado ("12.345" aceita separador de milhar). Vazio vira `undefined`. */
export const optionalInt = (min: number, max: number, message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? emptyToUndefined(value.replace(/\./g, "").trim()) : value),
    z.coerce.number(message).int(message).min(min, message).max(max, message).optional(),
  );

export const requiredInt = (min: number, max: number, message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\./g, "").trim() : value),
    z
      .string(message)
      .min(1, message)
      .transform(Number)
      .pipe(z.number(message).int(message).min(min, message).max(max, message)),
  );

/** Checkbox nativo/Radix: presente ("on", "1", "true") = marcado; ausente = desmarcado. */
export const checkbox = () =>
  z
    .union([z.literal(["on", "1", "true"]), z.undefined()])
    .catch(undefined)
    .transform((value) => value !== undefined);

/** Valor em reais opcional e estritamente positivo (lances e preço final; SPEC §7.6). */
export const optionalPositiveBrlAmount = (message = "Informe um valor maior que zero.") =>
  z.preprocess(
    emptyToUndefined,
    brlAmount(message)
      .refine((value) => value > 0, message)
      .optional(),
  );
