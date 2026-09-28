import { z } from "zod";

import {
  CATEGORY_KEYS,
  type CategoryKey,
  CONDITION_KEYS,
  type ConditionKey,
  DEFAULT_CATEGORY,
  DEFAULT_CONDITION,
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS_KM,
} from "@/domain/listings/criteria";
import { cents } from "@/domain/money";

export const LISTINGS_PAGE_SIZE = 24;

/** Raios na URL e nos formulários (texto), a partir de `RADIUS_OPTIONS_KM`. */
export const DISTANCE_OPTIONS = RADIUS_OPTIONS_KM.map(String);
export const DEFAULT_DISTANCE = String(DEFAULT_RADIUS_KM);

export const CATEGORY_LABELS = {
  veiculos: "Veículos (carros, motos e utilitários)",
  carros: "Carros",
  motos: "Motos",
  utilitarios: "Utilitários",
  pesados: "Pesados",
  sucatas: "Sucatas",
  todas: "Todas as categorias",
} satisfies Record<CategoryKey, string>;

export const CONDITION_LABELS = {
  qualquer: "Qualquer condição",
  "sem-monta": "Sem monta ou sucata informada",
  "ate-pequena": "Até pequena monta",
  "ate-media": "Até média monta",
  "com-monta": "Só com monta",
} satisfies Record<ConditionKey, string>;

const year = z.coerce.number().int().min(1900).max(2100).optional().catch(undefined);

/** Filtros de "Descobertos". Nunca lançam: valor inválido vira o padrão. */
export const listingFiltersSchema = z
  .object({
    busca: z
      .string()
      .trim()
      .max(100)
      .transform((value) => value || undefined)
      .optional()
      .catch(undefined),
    anoDe: year,
    anoAte: year,
    /** Preço máximo em reais inteiros (lance atual ou, sem lance, o inicial). */
    precoAte: z.coerce.number().int().positive().max(100_000_000).optional().catch(undefined),
    distancia: z.enum([...DISTANCE_OPTIONS, "todas"]).catch(DEFAULT_DISTANCE),
    categoria: z.enum(CATEGORY_KEYS).catch(DEFAULT_CATEGORY),
    condicao: z.enum(CONDITION_KEYS).catch(DEFAULT_CONDITION),
    situacao: z.enum(["abertos", "encerrados"]).catch("abertos"),
    pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
  })
  .transform(({ busca, anoDe, anoAte, precoAte, distancia, categoria, condicao, situacao, pagina }) => ({
    search: busca,
    yearFrom: anoDe,
    yearTo: anoAte,
    maxPrice: precoAte === undefined ? undefined : cents(precoAte * 100),
    distanceKm: distancia === "todas" ? null : Number(distancia),
    category: categoria,
    condition: condicao,
    ended: situacao === "encerrados",
    page: pagina,
  }));
export type ListingFilters = z.infer<typeof listingFiltersSchema>;
