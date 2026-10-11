import { z } from "zod";

import { VEHICLE_ORIGINS } from "@/domain/listings/origin";
import { DEFAULT_EVALUATE_FILTERS, type EvaluateFilters, MAX_EXCLUDED } from "@/domain/research/evaluate";
import {
  DEFAULT_RESEARCH_FILTERS,
  normalizeComparison,
  normalizeYears,
  RESEARCH_CATEGORIES,
  RESEARCH_CONDITIONS,
  RESEARCH_METRICS,
  RESEARCH_MILEAGE_OPTIONS,
  RESEARCH_PERIODS,
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

/** Id de fonte: sem lista fechada (as fontes vêm do banco), só o formato do id. */
const source = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{1,40}$/)
  .optional()
  .catch(undefined)
  .transform((value) => value ?? null);

/** "Km até": só uma das faixas oferecidas. */
const maxKm = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value) => RESEARCH_MILEAGE_OPTIONS.find((option) => String(option) === value) ?? null);

/** Período em dias: só um dos oferecidos. */
const period = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value) => RESEARCH_PERIODS.find((option) => String(option) === value) ?? null);

/** Id de anúncio (UUID): só o formato; quem consulta confere se é uma venda. */
const saleId = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .optional()
  .catch(undefined)
  .transform((value) => value?.toLowerCase() ?? null);

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
    fonte: source,
    kmate: maxKm,
    vsmarca: text,
    vsmodelo: text,
    vsuf: state,
    medida: z.enum(RESEARCH_METRICS).catch(DEFAULT_RESEARCH_FILTERS.metric),
    periodo: period,
    venda: saleId,
  })
  .transform((input): ResearchFilters => {
    const vehicle =
      input.marca === undefined || input.modelo === undefined ? null : researchVehicle(input.marca, input.modelo);
    const compareVehicle =
      input.vsmarca === undefined || input.vsmodelo === undefined
        ? null
        : researchVehicle(input.vsmarca, input.vsmodelo);
    return {
      category: input.categoria,
      condition: input.condicao,
      vehicle,
      state: input.uf,
      // O ano só vale dentro de um modelo.
      ...(vehicle === null ? { yearFrom: null, yearTo: null } : normalizeYears(input.anode, input.anoate)),
      source: input.fonte,
      maxKm: input.kmate,
      // A comparação só vale se difere dos filtros (outro modelo ou outro estado).
      compare: normalizeComparison({ vehicle, state: input.uf }, { vehicle: compareVehicle, state: input.vsuf }),
      metric: input.medida,
      period: input.periodo,
      sale: input.venda,
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
    fonte: filters.source ?? undefined,
    kmate: filters.maxKm?.toString(),
    vsmarca: filters.compare?.vehicle?.brand,
    vsmodelo: filters.compare?.vehicle?.model,
    vsuf: filters.compare?.state ?? undefined,
    medida: filters.metric === DEFAULT_RESEARCH_FILTERS.metric ? undefined : filters.metric,
    periodo: filters.period?.toString(),
    venda: filters.sale ?? undefined,
  };
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])),
  );
}

const FIPE_CODE = /^\d{6}-\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Filtros do Avaliar (docs/PLANO-MERCADO.md §5, D-71) na URL. Nunca lança: valor inválido vira o padrão. */
export const evaluateFiltersSchema = z
  .object({
    marca: text,
    modelo: text,
    familia: z.string().trim().max(80).optional().catch(undefined),
    versao: z.string().trim().regex(FIPE_CODE).optional().catch(undefined),
    anode: year,
    anoate: year,
    kmate: maxKm,
    condicao: z.enum(RESEARCH_CONDITIONS).catch(DEFAULT_EVALUATE_FILTERS.condition),
    origem: z.enum(VEHICLE_ORIGINS).optional().catch(undefined),
    lote: z.string().trim().toLowerCase().regex(UUID).optional().catch(undefined),
    fora: z.string().optional().catch(undefined),
  })
  .transform((input): EvaluateFilters => {
    const vehicle =
      input.marca === undefined || input.modelo === undefined ? null : researchVehicle(input.marca, input.modelo);
    const excluded = [
      ...new Set(
        (input.fora ?? "")
          .split(",")
          .map((id) => id.trim().toLowerCase())
          .filter((id) => UUID.test(id)),
      ),
    ].slice(0, MAX_EXCLUDED);
    return {
      vehicle,
      // Família e versão só valem dentro de um modelo, e a família precisa ser dele.
      family: vehicle === null || !input.familia?.startsWith(`${vehicle.brand}|`) ? null : (input.familia ?? null),
      version: vehicle === null ? null : (input.versao ?? null),
      ...(vehicle === null ? { yearFrom: null, yearTo: null } : normalizeYears(input.anode, input.anoate)),
      maxKm: input.kmate,
      condition: input.condicao,
      origin: input.origem ?? null,
      lot: input.lote ?? null,
      excluded,
    };
  });

/** URL crua (`searchParams`) → filtros do Avaliar. Parâmetro repetido: vale o primeiro. */
export function parseEvaluateParams(raw: Readonly<Record<string, string | string[] | undefined>>): EvaluateFilters {
  return evaluateFiltersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])),
  );
}

/** Filtros do Avaliar → parâmetros da URL, sem os padrões. Inverso de `parseEvaluateParams`. */
export function evaluateParams(filters: EvaluateFilters): Record<string, string> {
  const params: Record<string, string | undefined> = {
    marca: filters.vehicle?.brand,
    modelo: filters.vehicle?.model,
    familia: filters.vehicle === null ? undefined : (filters.family ?? undefined),
    versao: filters.vehicle === null ? undefined : (filters.version ?? undefined),
    anode: filters.vehicle === null ? undefined : filters.yearFrom?.toString(),
    anoate: filters.vehicle === null ? undefined : filters.yearTo?.toString(),
    kmate: filters.maxKm?.toString(),
    condicao: filters.condition === DEFAULT_EVALUATE_FILTERS.condition ? undefined : filters.condition,
    origem: filters.origin ?? undefined,
    lote: filters.lot ?? undefined,
    fora: filters.excluded.length === 0 ? undefined : filters.excluded.join(","),
  };
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])),
  );
}
