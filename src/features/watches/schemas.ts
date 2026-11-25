import { z } from "zod";

import {
  CATEGORY_KEYS,
  CONDITION_KEYS,
  DEFAULT_CONDITION,
  FUEL_KEYS,
  HIDE_KEYS,
  type ListingCriteria,
  MARKET_PCT_OPTIONS,
  MILEAGE_OPTIONS_KM,
  ORIGIN_KEYS,
} from "@/domain/listings/criteria";
import { DEFAULT_DISTANCE, DISTANCE_OPTIONS } from "@/lib/listing-filters";
import { checkbox, entityId, optionalInt, optionalPositiveBrlAmount, optionalText } from "@/lib/schemas";

const YEAR_MESSAGE = "Informe um ano entre 1900 e 2100.";

/** Lista separada por vírgula (campos escondidos dos chips), só com chaves conhecidas, na ordem de `keys`. */
const keyList = <T extends string>(keys: readonly T[]) =>
  z
    .string()
    .optional()
    .catch(undefined)
    .transform((value) => {
      const items = (value ?? "").split(",");
      return keys.filter((key) => items.includes(key));
    });

const sourceIds = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value) => (value ?? "").split(",").filter((item) => /^[a-z0-9-]{1,40}$/.test(item)));

const numberOption = (values: readonly number[]) =>
  z
    .string()
    .optional()
    .catch(undefined)
    .transform((value) => {
      const number = Number(value);
      return value && values.includes(number) ? number : null;
    });

/** Regra dos monitores: sem critério de veículo, todo lote novo da região viraria alerta. */
export function hasVehicleCriterion(criteria: ListingCriteria): boolean {
  return (
    criteria.search !== null ||
    criteria.yearFrom !== null ||
    criteria.yearTo !== null ||
    criteria.minPrice !== null ||
    criteria.maxPrice !== null ||
    criteria.maxMarketPct !== null
  );
}

/** "Salvar como monitor" em Leilões: só o nome; os critérios vêm da busca atual. */
export const quickWatchSchema = z.object({
  name: optionalText().pipe(z.string().max(80, "Use até 80 caracteres.").optional()),
});

/**
 * Cadastro e edição de monitor (docs/PLANO-COLETA.md, etapa 2; critérios de docs/PLANO-FILTROS.md). Mesmos critérios
 * de "Leilões". Pelo menos um critério de veículo é exigido: sem ele, todo lote novo da região viraria alerta.
 */
export const watchInputSchema = z
  .object({
    name: optionalText().pipe(z.string().max(80, "Use até 80 caracteres.").optional()),
    search: optionalText().pipe(z.string().max(100, "Use até 100 caracteres.").optional()),
    yearFrom: optionalInt(1900, 2100, YEAR_MESSAGE),
    yearTo: optionalInt(1900, 2100, YEAR_MESSAGE),
    minPrice: optionalPositiveBrlAmount(),
    maxPrice: optionalPositiveBrlAmount(),
    maxMarketPct: numberOption(MARKET_PCT_OPTIONS),
    maxMileageKm: numberOption(MILEAGE_OPTIONS_KM),
    distance: z.enum([...DISTANCE_OPTIONS, "todas"], "Selecione a distância.").catch(DEFAULT_DISTANCE),
    categories: keyList(CATEGORY_KEYS),
    condition: z.enum(CONDITION_KEYS, "Selecione a condição.").catch(DEFAULT_CONDITION),
    hide: keyList(HIDE_KEYS),
    sources: sourceIds,
    origins: keyList(ORIGIN_KEYS),
    fuels: keyList(FUEL_KEYS),
    keyOnly: checkbox(),
  })
  .superRefine((input, ctx) => {
    // Zod 4 roda a regra cruzada mesmo com campo inválido: só compara valores válidos.
    const { yearFrom, yearTo, minPrice, maxPrice } = input;
    if (Number.isInteger(yearFrom) && Number.isInteger(yearTo) && Number(yearFrom) > Number(yearTo)) {
      ctx.addIssue({ code: "custom", path: ["yearTo"], message: "O ano final deve ser igual ou maior que o inicial." });
    }
    if (typeof minPrice === "number" && typeof maxPrice === "number" && minPrice > maxPrice) {
      ctx.addIssue({ code: "custom", path: ["maxPrice"], message: "O preço máximo deve ser maior que o mínimo." });
    }
    if (
      input.search === undefined &&
      input.yearFrom === undefined &&
      input.yearTo === undefined &&
      input.minPrice === undefined &&
      input.maxPrice === undefined &&
      input.maxMarketPct === null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["search"],
        message: "Informe marca ou modelo, um ano, uma faixa de preço ou um teto do valor de mercado.",
      });
    }
  })
  .transform(({ name, distance, categories, ...input }): { name: string | null; criteria: ListingCriteria } => ({
    name: name ?? null,
    criteria: {
      search: input.search ?? null,
      yearFrom: input.yearFrom ?? null,
      yearTo: input.yearTo ?? null,
      minPrice: input.minPrice ?? null,
      maxPrice: input.maxPrice ?? null,
      maxMarketPct: input.maxMarketPct,
      maxMileageKm: input.maxMileageKm,
      radiusKm: distance === "todas" ? null : Number(distance),
      // Nenhuma marcada: todas as categorias.
      categories: categories.length === 0 ? null : categories,
      condition: input.condition,
      hide: input.hide,
      sources: input.sources,
      origins: input.origins,
      fuels: input.fuels,
      keyOnly: input.keyOnly,
    },
  }));
export type WatchInput = z.infer<typeof watchInputSchema>;

export const watchIdSchema = entityId();
