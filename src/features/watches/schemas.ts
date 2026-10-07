import { z } from "zod";

import { CATEGORY_KEYS, CONDITION_KEYS, DEFAULT_CATEGORY, DEFAULT_CONDITION } from "@/domain/listings/criteria";
import { DEFAULT_DISTANCE, DISTANCE_OPTIONS } from "@/features/listings/schemas";
import { entityId, optionalInt, optionalPositiveBrlAmount, optionalText } from "@/lib/schemas";

const YEAR_MESSAGE = "Informe um ano entre 1900 e 2100.";

/**
 * Cadastro e edição de monitor (docs/PLANO-COLETA.md, etapa 2). Mesmos critérios de "Leilões".
 * Pelo menos um critério de veículo é exigido: sem ele, todo lote novo da região viraria alerta.
 */
export const watchInputSchema = z
  .object({
    name: optionalText().pipe(z.string().max(80, "Use até 80 caracteres.").optional()),
    search: optionalText().pipe(z.string().max(100, "Use até 100 caracteres.").optional()),
    yearFrom: optionalInt(1900, 2100, YEAR_MESSAGE),
    yearTo: optionalInt(1900, 2100, YEAR_MESSAGE),
    maxPrice: optionalPositiveBrlAmount(),
    distance: z.enum([...DISTANCE_OPTIONS, "todas"], "Selecione a distância.").catch(DEFAULT_DISTANCE),
    category: z.enum(CATEGORY_KEYS, "Selecione a categoria.").catch(DEFAULT_CATEGORY),
    condition: z.enum(CONDITION_KEYS, "Selecione a condição.").catch(DEFAULT_CONDITION),
  })
  .superRefine((input, ctx) => {
    // Zod 4 roda a regra cruzada mesmo com campo inválido: só compara anos válidos.
    const { yearFrom, yearTo } = input;
    if (Number.isInteger(yearFrom) && Number.isInteger(yearTo) && Number(yearFrom) > Number(yearTo)) {
      ctx.addIssue({ code: "custom", path: ["yearTo"], message: "O ano final deve ser igual ou maior que o inicial." });
    }
    if (
      input.search === undefined &&
      input.yearFrom === undefined &&
      input.yearTo === undefined &&
      input.maxPrice === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["search"],
        message: "Informe marca ou modelo, um ano ou um lance máximo.",
      });
    }
  })
  .transform(({ distance, ...input }) => ({
    ...input,
    radiusKm: distance === "todas" ? null : Number(distance),
  }));
export type WatchInput = z.infer<typeof watchInputSchema>;

export const watchIdSchema = entityId();
