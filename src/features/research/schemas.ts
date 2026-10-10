import { z } from "zod";

import {
  DEFAULT_RESEARCH_FILTERS,
  normalizeYears,
  RESEARCH_CATEGORIES,
  RESEARCH_CONDITIONS,
  RESEARCH_METRICS,
  type ResearchFilters,
  researchVehicle,
} from "@/domain/research/filters";
import { isStateCode, type StateCode } from "@/domain/research/states";

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

/** Ano-modelo da URL: só inteiro; vazio ou inválido vira ausente (os limites ficam em `normalizeYears`). */
const year = z
  .string()
  .trim()
  .regex(/^\d{4}$/)
  .optional()
  .catch(undefined)
  .transform((value) => (value === undefined ? null : Number(value)));

/** Filtros da Pesquisa (D-45) na URL. Nunca lança: valor inválido vira o padrão. */
export const researchFiltersSchema = z
  .object({
    categoria: z.enum(RESEARCH_CATEGORIES).catch(DEFAULT_RESEARCH_FILTERS.category),
    condicao: z.enum(RESEARCH_CONDITIONS).catch(DEFAULT_RESEARCH_FILTERS.condition),
    marca: text,
    modelo: text,
    uf: state,
    anode: year,
    anoate: year,
    medida: z.enum(RESEARCH_METRICS).catch(DEFAULT_RESEARCH_FILTERS.metric),
  })
  .transform((input): ResearchFilters => {
    const vehicle =
      input.marca === undefined || input.modelo === undefined ? null : researchVehicle(input.marca, input.modelo);
    return {
      category: input.categoria,
      condition: input.condicao,
      vehicle,
      state: input.uf,
      // O ano só vale dentro de um modelo.
      ...(vehicle === null ? { yearFrom: null, yearTo: null } : normalizeYears(input.anode, input.anoate)),
      metric: input.medida,
    };
  });

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
    anode: filters.vehicle === null ? undefined : filters.yearFrom?.toString(),
    anoate: filters.vehicle === null ? undefined : filters.yearTo?.toString(),
    medida: filters.metric === DEFAULT_RESEARCH_FILTERS.metric ? undefined : filters.metric,
  };
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])),
  );
}
