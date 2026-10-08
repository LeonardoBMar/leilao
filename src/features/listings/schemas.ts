import { z } from "zod";

import {
  CATEGORY_KEYS,
  type CategoryKey,
  CONDITION_KEYS,
  DEFAULT_CATEGORIES,
  DEFAULT_CONDITION,
  DEFAULT_RADIUS_KM,
  FUEL_KEYS,
  HIDE_KEYS,
  type ListingCriteria,
  MARKET_PCT_OPTIONS,
  MILEAGE_OPTIONS_KM,
  ORIGIN_KEYS,
  RADIUS_OPTIONS_KM,
} from "@/domain/listings/criteria";
import { cents } from "@/domain/money";

export const LISTINGS_PAGE_SIZE = 24;
export const CATALOG_AUCTIONS_PAGE_SIZE = 24;

/** Raios na URL e nos formulários (texto), a partir de `RADIUS_OPTIONS_KM`. */
export const DISTANCE_OPTIONS = RADIUS_OPTIONS_KM.map(String);
export const DEFAULT_DISTANCE = String(DEFAULT_RADIUS_KM);

/** Prazo até o encerramento (só abertos), em horas. */
export const ENDS_WITHIN_HOURS = { "24h": 24, "48h": 48, "7d": 168 } as const;
export type EndsWithin = keyof typeof ENDS_WITHIN_HOURS;
export const ENDS_WITHIN_KEYS = Object.keys(ENDS_WITHIN_HOURS) as EndsWithin[];

/** Janela de "Só novos": vistos pela primeira vez nas últimas 24 h. */
export const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

export const SORT_KEYS = ["encerra", "menor-lance", "mercado", "perto", "novos"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/**
 * Filtros dos anúncios em "Leilões" (docs/PLANO-FILTROS.md §3). `criteria` é o formato comum com os monitores;
 * o resto vale só para a tela. Nunca lançam: valor inválido vira o padrão, e item desconhecido numa lista é ignorado.
 */
export type ListingFilters = {
  criteria: ListingCriteria;
  endsWithin: EndsWithin | null;
  bids: "com" | "sem" | null;
  newOnly: boolean;
  analyzed: "esconder" | "so" | null;
  ended: boolean;
  sort: SortKey;
  page: number;
};

const text = z
  .string()
  .trim()
  .max(100)
  .transform((value) => value || undefined)
  .optional()
  .catch(undefined);
const year = z.coerce.number().int().min(1900).max(2100).optional().catch(undefined);
/** Reais inteiros. */
const reais = z.coerce.number().int().positive().max(100_000_000).optional().catch(undefined);
const flag = z
  .literal("1")
  .optional()
  .catch(undefined)
  .transform((value) => value === "1");
const option = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().catch(undefined);
const numberOption = (values: readonly number[]) =>
  z.coerce
    .number()
    .refine((value) => values.includes(value))
    .optional()
    .catch(undefined);

/** Lista separada por vírgula, só com as chaves conhecidas e sem repetição, na ordem de `keys`. */
const list = <T extends string>(keys: readonly T[]) =>
  z
    .string()
    .optional()
    .catch(undefined)
    .transform((value) => {
      const items = (value ?? "").split(",").map((item) => item.trim());
      return keys.filter((key) => items.includes(key));
    });

/** Ids de fonte: sem lista fechada aqui (as fontes vêm do banco), só o formato do id. */
const sourceList = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value) => [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter((item) => /^[a-z0-9-]{1,40}$/.test(item)),
    ),
  ]);

/** Ausente: o padrão. "todas": sem restrição. Aceita os grupos antigos ("veiculos"). */
const categories = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value): readonly CategoryKey[] | null => {
    if (value === undefined || value === "veiculos") return DEFAULT_CATEGORIES;
    if (value === "todas") return null;
    const items = value.split(",").map((item) => item.trim());
    const keys = CATEGORY_KEYS.filter((key) => items.includes(key));
    return keys.length > 0 ? keys : DEFAULT_CATEGORIES;
  });

export const listingFiltersSchema = z
  .object({
    busca: text,
    anoDe: year,
    anoAte: year,
    precoDe: reais,
    precoAte: reais,
    mercado: numberOption(MARKET_PCT_OPTIONS),
    kmAte: numberOption(MILEAGE_OPTIONS_KM),
    distancia: z.enum([...DISTANCE_OPTIONS, "todas"]).catch(DEFAULT_DISTANCE),
    categoria: categories,
    condicao: z.enum(CONDITION_KEYS).catch(DEFAULT_CONDITION),
    ocultar: list(HIDE_KEYS),
    fonte: sourceList,
    origem: list(ORIGIN_KEYS),
    combustivel: list(FUEL_KEYS),
    chave: flag,
    lances: option(["com", "sem"]),
    encerra: option(["24h", "48h", "7d"]),
    novos: flag,
    analisados: option(["esconder", "so"]),
    situacao: z.enum(["abertos", "encerrados"]).catch("abertos"),
    ordem: z.enum(SORT_KEYS).catch("encerra"),
    pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
  })
  .transform((input): ListingFilters => {
    // Faixas invertidas na URL (editada à mão) são trocadas, em vez de não mostrar nada.
    const [yearFrom, yearTo] = ordered(input.anoDe, input.anoAte);
    const [minPrice, maxPrice] = ordered(input.precoDe, input.precoAte);
    const ended = input.situacao === "encerrados";
    return {
      criteria: {
        search: input.busca ?? null,
        yearFrom: yearFrom ?? null,
        yearTo: yearTo ?? null,
        minPrice: minPrice === undefined ? null : cents(minPrice * 100),
        maxPrice: maxPrice === undefined ? null : cents(maxPrice * 100),
        maxMarketPct: input.mercado ?? null,
        maxMileageKm: input.kmAte ?? null,
        radiusKm: input.distancia === "todas" ? null : Number(input.distancia),
        categories: input.categoria,
        condition: input.condicao,
        hide: input.ocultar,
        sources: input.fonte,
        origins: input.origem,
        fuels: input.combustivel,
        keyOnly: input.chave,
      },
      // Prazo só faz sentido para abertos.
      endsWithin: ended ? null : (input.encerra ?? null),
      bids: input.lances ?? null,
      newOnly: input.novos,
      analyzed: input.analisados ?? null,
      ended,
      sort: input.ordem,
      page: input.pagina,
    };
  });

function ordered(from: number | undefined, to: number | undefined): [number | undefined, number | undefined] {
  return from !== undefined && to !== undefined && from > to ? [to, from] : [from, to];
}

/** URL crua (`searchParams`) → filtros. Parâmetro repetido: vale o primeiro. */
export function parseListingParams(raw: Readonly<Record<string, string | string[] | undefined>>): ListingFilters {
  return listingFiltersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])),
  );
}

const sameKeys = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

/**
 * Filtros → parâmetros da URL, sem os padrões e sem página (quem pagina acrescenta). É o inverso de
 * `parseListingParams`: `parseListingParams(listingParams(f))` devolve `f` com a página 1.
 */
export function listingParams(filters: ListingFilters): Record<string, string> {
  const { criteria } = filters;
  const reaisOf = (value: number | null) => (value === null ? undefined : String(Math.round(value / 100)));
  const csv = (items: readonly string[]) => (items.length > 0 ? items.join(",") : undefined);
  const params: Record<string, string | undefined> = {
    busca: criteria.search ?? undefined,
    anoDe: criteria.yearFrom?.toString(),
    anoAte: criteria.yearTo?.toString(),
    precoDe: reaisOf(criteria.minPrice),
    precoAte: reaisOf(criteria.maxPrice),
    mercado: criteria.maxMarketPct?.toString(),
    kmAte: criteria.maxMileageKm?.toString(),
    distancia:
      criteria.radiusKm === DEFAULT_RADIUS_KM
        ? undefined
        : criteria.radiusKm === null
          ? "todas"
          : String(criteria.radiusKm),
    categoria:
      criteria.categories === null
        ? "todas"
        : sameKeys(criteria.categories, DEFAULT_CATEGORIES)
          ? undefined
          : csv(criteria.categories),
    condicao: criteria.condition === DEFAULT_CONDITION ? undefined : criteria.condition,
    ocultar: csv(criteria.hide),
    fonte: csv(criteria.sources),
    origem: csv(criteria.origins),
    combustivel: csv(criteria.fuels),
    chave: criteria.keyOnly ? "1" : undefined,
    lances: filters.bids ?? undefined,
    encerra: filters.endsWithin ?? undefined,
    novos: filters.newOnly ? "1" : undefined,
    analisados: filters.analyzed ?? undefined,
    situacao: filters.ended ? "encerrados" : undefined,
    ordem: filters.sort === "encerra" ? undefined : filters.sort,
  };
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])),
  );
}

/** Segmentos de `/leiloes/[source]/[auction]` (D-42). Inválido: a página responde 404. */
export const catalogAuctionParamsSchema = z
  .object({
    source: z.string().regex(/^[a-z0-9-]{1,40}$/),
    auction: z.string().regex(/^[A-Za-z0-9._-]{1,200}$/),
  })
  .transform(({ source, auction }) => ({ sourceId: source, externalId: auction }));
