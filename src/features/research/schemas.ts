import { z } from "zod";

import {
  DEFAULT_RESEARCH_FILTERS,
  RESEARCH_CATEGORIES,
  RESEARCH_CONDITIONS,
  RESEARCH_METRICS,
  type ResearchFilters,
  researchVehicle,
} from "@/domain/research/filters";
import { isStateCode, type StateCode } from "@/domain/research/tile-map";

/** Texto livre da URL: aparado, até 60 caracteres; vazio ou inválido vira ausente. */
const text = z
  .string()
  .trim()
  .max(60)
  .optional()
  .catch(undefined)
  .transform((value) => (value === "" ? undefined : value));

const state = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value): StateCode | null => {
    const code = value?.trim().toUpperCase() ?? "";
    return isStateCode(code) ? code : null;
  });

/** Filtros da Pesquisa (D-45) na URL. Nunca lança: valor inválido vira o padrão. */
export const researchFiltersSchema = z
  .object({
    categoria: z.enum(RESEARCH_CATEGORIES).catch(DEFAULT_RESEARCH_FILTERS.category),
    condicao: z.enum(RESEARCH_CONDITIONS).catch(DEFAULT_RESEARCH_FILTERS.condition),
    marca: text,
    modelo: text,
    uf: state,
    medida: z.enum(RESEARCH_METRICS).catch(DEFAULT_RESEARCH_FILTERS.metric),
  })
  .transform((input): ResearchFilters => ({
    category: input.categoria,
    condition: input.condicao,
    vehicle:
      input.marca === undefined || input.modelo === undefined ? null : researchVehicle(input.marca, input.modelo),
    state: input.uf,
    metric: input.medida,
  }));

/** URL crua (`searchParams`) → filtros. Parâmetro repetido: vale o primeiro. */
export function parseResearchParams(raw: Readonly<Record<string, string | string[] | undefined>>): ResearchFilters {
  return researchFiltersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])),
  );
}

/** Filtros → parâmetros da URL, sem os padrões. Inverso de `parseResearchParams`. */
export function researchParams(filters: ResearchFilters): Record<string, string> {
  const params: Record<string, string | undefined> = {
    categoria: filters.category === DEFAULT_RESEARCH_FILTERS.category ? undefined : filters.category,
    condicao: filters.condition === DEFAULT_RESEARCH_FILTERS.condition ? undefined : filters.condition,
    marca: filters.vehicle?.brand,
    modelo: filters.vehicle?.model,
    uf: filters.state ?? undefined,
    medida: filters.metric === DEFAULT_RESEARCH_FILTERS.metric ? undefined : filters.metric,
  };
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])),
  );
}
