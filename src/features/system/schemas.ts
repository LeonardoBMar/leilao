import { z } from "zod";

import { entityId, optionalText } from "@/lib/schemas";

export const toggleSourceSchema = z.object({
  sourceId: z.string().trim().min(1, "Fonte inválida.").max(40, "Fonte inválida."),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const collectorRunErrorsSchema = z
  .array(
    z.object({
      url: z.string(),
      error: z.string(),
    }),
  )
  .catch([]);

const VEHICLE_TYPE_MAP = { "1": 1, "2": 2, "3": 3 } as const;

const vehicleTypeSchema = z.enum(["1", "2", "3"]).transform((value) => VEHICLE_TYPE_MAP[value]);

export const fipeQueueFiltersSchema = z.object({
  situacao: z.enum(["none", "version", "family", "todos"]).catch("none"),
  origem: z.enum(["auto", "manual", "todas"]).catch("todas"),
  busca: optionalText().catch(undefined),
  item: entityId().optional().catch(undefined),
  tipo: vehicleTypeSchema.optional().catch(undefined),
  marca: optionalText().catch(undefined),
});

export type FipeQueueFilters = z.infer<typeof fipeQueueFiltersSchema>;

export const saveManualFipeMatchSchema = z
  .object({
    matchId: entityId(),
    mode: z.enum(["models", "none"]),
    vehicleType: vehicleTypeSchema.optional(),
    brandCode: optionalText().pipe(z.string().max(120, "Marca inválida.").optional()),
    modelCodes: z.array(z.string().trim().min(1).max(40)).max(50, "Selecione no máximo 50 versões.").default([]),
  })
  .refine((value) => value.mode === "none" || value.modelCodes.length > 0, {
    message: "Selecione ao menos uma versão FIPE ou marque sem casamento.",
    path: ["modelCodes"],
  });

export type SaveManualFipeMatchInput = z.infer<typeof saveManualFipeMatchSchema>;

export const resetFipeMatchSchema = z.object({
  matchId: entityId(),
});
