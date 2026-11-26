import { z } from "zod";

import { BUYER_PROFILES } from "@/domain/finance/defaults";
import { type Bps, type Cents, parsePercent } from "@/domain/money";
import { optionalBrlAmount, optionalInt } from "@/lib/schemas";

export const RADIUS_KM_MIN = 10;
export const RADIUS_KM_MAX = 5_000;
export const MARGIN_BPS_MAX = 9_000;
export const RESERVE_BPS_MAX = 5_000;
export const DISCOUNT_BPS_MAX = 9_000;

const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

function optionalPercentBps(maxBps: number, message: string) {
  return z
    .preprocess(
      emptyToUndefined,
      z
        .string(message)
        .transform((value, ctx) => {
          const parsed = parsePercent(value);
          if (parsed === null || parsed < 0 || parsed > maxBps) {
            ctx.addIssue({ code: "custom", message });
            return z.NEVER;
          }
          return parsed;
        })
        .optional(),
    )
    .transform((value): Bps | null => value ?? null);
}

function optionalMoneyCents(message: string) {
  return optionalBrlAmount(message).transform((value): Cents | null => value ?? null);
}

export const userPreferencesInputSchema = z.object({
  buyerProfile: z
    .preprocess(emptyToUndefined, z.enum(BUYER_PROFILES, "Selecione um perfil operacional válido.").optional())
    .transform((value) => value ?? null),
  municipalityIbgeCode: optionalInt(1_000_000, 9_999_999, "Selecione um município válido da lista.").transform(
    (value) => value ?? null,
  ),
  radiusKm: optionalInt(
    RADIUS_KM_MIN,
    RADIUS_KM_MAX,
    `Informe um raio entre ${RADIUS_KM_MIN} e ${RADIUS_KM_MAX} km.`,
  ).transform((value) => value ?? null),
  desiredMarginRateBps: optionalPercentBps(MARGIN_BPS_MAX, "Informe uma margem entre 0% e 90%."),
  riskReserveRateBps: optionalPercentBps(RESERVE_BPS_MAX, "Informe uma reserva entre 0% e 50%."),
  documentationCost: optionalMoneyCents("Informe um custo de documentação válido (R$ 0 ou mais)."),
  towBase: optionalMoneyCents("Informe uma taxa base de guincho válida (R$ 0 ou mais)."),
  towPerKm: optionalMoneyCents("Informe um valor por km de guincho válido (R$ 0 ou mais)."),
  towUnknownDistance: optionalMoneyCents("Informe um guincho para distância desconhecida válido (R$ 0 ou mais)."),
  saleDiscountNoneBps: optionalPercentBps(DISCOUNT_BPS_MAX, "Informe um desconto entre 0% e 90%."),
  saleDiscountSmallBps: optionalPercentBps(DISCOUNT_BPS_MAX, "Informe um desconto entre 0% e 90%."),
  saleDiscountMediumBps: optionalPercentBps(DISCOUNT_BPS_MAX, "Informe um desconto entre 0% e 90%."),
  saleDiscountLargeBps: optionalPercentBps(DISCOUNT_BPS_MAX, "Informe um desconto entre 0% e 90%."),
});

export type UserPreferencesInput = z.infer<typeof userPreferencesInputSchema>;

export const municipalitySearchSchema = z.string().trim().min(2).max(80);
