import { z } from "zod";

import { DAMAGE_LEVELS } from "@/domain/listings/condition";
import { bps, cents } from "@/domain/money";
import { optionalBrlAmount, optionalInt, optionalText, optionalUrl, requiredText } from "@/lib/schemas";

/**
 * Schemas Zod compartilhados entre o Importador Universal (`/minhas-analises/importar`)
 * e a API v1 (`POST /api/v1/lots/import`, `GET /api/v1/market/evaluate`, `GET /api/v1/openapi.json`, D-98).
 */

const currentMaxYear = new Date().getUTCFullYear() + 2;

const boundedOptionalText = (max: number) =>
  optionalText().refine((value) => value === undefined || value.length <= max, `Máximo de ${max} caracteres.`);

const boundedRequiredText = (message: string, max: number) =>
  requiredText(message).max(max, `Máximo de ${max} caracteres.`);

export const previewImportInputSchema = z
  .object({
    url: optionalUrl(),
    rawText: boundedOptionalText(250_000),
  })
  .refine(
    (value) =>
      (value.url !== undefined && value.url.length > 0) || (value.rawText !== undefined && value.rawText.length >= 10),
    { message: "Informe a URL do lote ou cole o texto da página do leiloeiro.", path: ["rawText"] },
  );

const optionalPercentBps = z
  .string()
  .optional()
  .transform((value) => (value ?? "").trim())
  .pipe(
    z.union([
      z.literal("").transform(() => undefined),
      z
        .string()
        .transform((raw) => Number(raw.replace("%", "").replace(",", ".").trim()))
        .refine((num) => Number.isFinite(num) && num >= 0 && num <= 30, "Comissão deve ficar entre 0% e 30%.")
        .transform((num) => bps(Math.round(num * 100))),
    ]),
  );

export const confirmImportFormSchema = z.object({
  auctioneer: boundedRequiredText("Informe o leiloeiro.", 120),
  auctionName: boundedRequiredText("Informe o nome do leilão.", 160),
  lotNumber: boundedRequiredText("Informe o número do lote.", 40),
  brand: boundedRequiredText("Informe a marca.", 60),
  model: boundedRequiredText("Informe o modelo.", 100),
  vehicleVersion: boundedOptionalText(120),
  manufactureYear: optionalInt(1950, currentMaxYear, "Ano de fabricação inválido."),
  modelYear: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => /^\d{4}$/.test(v), "Informe o ano modelo (4 dígitos).")
    .transform(Number)
    .refine((year) => year >= 1950 && year <= currentMaxYear, "Ano modelo fora da faixa válida."),
  mileageKm: optionalInt(0, 2_000_000, "Quilometragem inválida."),
  fuel: boundedOptionalText(40),
  damageLevel: z
    .union([z.literal(""), z.enum(DAMAGE_LEVELS)])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  isMotorcycle: z
    .string()
    .optional()
    .transform((value) => value === "true" || value === "on"),
  currentBid: optionalBrlAmount("Lance atual inválido."),
  commissionRateBps: optionalPercentBps,
  otherFees: optionalBrlAmount("Outras taxas inválidas."),
  fipeValue: optionalBrlAmount("Valor FIPE inválido."),
  fipeRefMonth: optionalText().refine((v) => v === undefined || /^\d{4}-\d{2}$/.test(v), "Mês FIPE inválido."),
  city: boundedOptionalText(80),
  state: optionalText()
    .transform((v) => (v ? v.toUpperCase() : undefined))
    .refine((v) => v === undefined || /^[A-Z]{2}$/.test(v), "UF inválida."),
  startsAtIso: boundedOptionalText(40),
  lotUrl: optionalUrl(),
  notes: boundedOptionalText(5_000),
});

export type ConfirmImportForm = z.infer<typeof confirmImportFormSchema>;

/** Contrato JSON da API v1 `POST /api/v1/lots/import` (ARCHITECTURE §17). */
export const apiImportLotSchema = z.object({
  auctioneer: z.string().trim().min(1).max(120),
  auctionName: z.string().trim().min(1).max(160).optional(),
  lotNumber: z.string().trim().min(1).max(40),
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(100),
  vehicleVersion: z.string().trim().max(120).nullable().optional(),
  manufactureYear: z.number().int().min(1950).max(currentMaxYear).nullable().optional(),
  modelYear: z.number().int().min(1950).max(currentMaxYear),
  mileageKm: z.number().int().min(0).max(2_000_000).nullable().optional(),
  fuel: z.string().trim().max(40).nullable().optional(),
  damageLevel: z.enum(DAMAGE_LEVELS).nullable().optional(),
  isMotorcycle: z.boolean().optional(),
  currentBidCents: z.number().int().min(0).max(500_000_000).nullable().optional(),
  commissionRateBps: z.number().int().min(0).max(3_000).nullable().optional(),
  otherFeesCents: z.number().int().min(0).max(50_000_000).nullable().optional(),
  fipeValueCents: z.number().int().min(0).max(500_000_000).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((v) => v.toUpperCase())
    .nullable()
    .optional(),
  startsAt: z.iso.datetime().nullable().optional(),
  lotUrl: z
    .url({ protocol: /^https?$/, hostname: z.regexes.domain, error: "Informe uma URL http(s) válida." })
    .max(2_000)
    .nullable()
    .optional(),
  notes: z.string().trim().max(5_000).nullable().optional(),
});

export type ApiImportLotPayload = z.infer<typeof apiImportLotSchema>;

/** Contrato de query string da API v1 `GET /api/v1/market/evaluate` (ARCHITECTURE §17). */
export const apiEvaluateMarketQuerySchema = z.object({
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(100),
  year: z.coerce.number().int().min(1950).max(currentMaxYear),
  damageLevel: z.enum(DAMAGE_LEVELS).optional(),
  mileageKm: z.coerce.number().int().min(0).max(2_000_000).optional(),
  fipeCents: z.coerce
    .number()
    .int()
    .min(1)
    .max(500_000_000)
    .transform((v) => cents(v))
    .optional(),
  isMotorcycle: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export type ApiEvaluateMarketQuery = z.infer<typeof apiEvaluateMarketQuerySchema>;
