import { z } from "zod";

import type { DamageLevel } from "@/domain/listings/condition";
import { cents } from "@/domain/money";

export const LISTINGS_PAGE_SIZE = 24;

/** Raios oferecidos no filtro, em km a partir da região padrão (São Carlos/SP). */
export const DISTANCE_OPTIONS = ["50", "100", "150", "300"] as const;
export const DEFAULT_DISTANCE = "150";

/**
 * Categorias como a fonte escreve (Leilo). "veiculos" é o padrão: o que o fluxo de análise cobre.
 * Imóveis e equipamentos ficam no catálogo, mas só aparecem em "todas".
 */
export const CATEGORY_KEYS = ["veiculos", "carros", "motos", "utilitarios", "pesados", "sucatas", "todas"] as const;
export type CategoryOption = (typeof CATEGORY_KEYS)[number];

export const CATEGORY_OPTIONS = {
  veiculos: { label: "Veículos (carros, motos e utilitários)", categories: ["Carros", "Motos", "Utilitarios"] },
  carros: { label: "Carros", categories: ["Carros"] },
  motos: { label: "Motos", categories: ["Motos"] },
  utilitarios: { label: "Utilitários", categories: ["Utilitarios"] },
  pesados: { label: "Pesados", categories: ["Pesados"] },
  sucatas: { label: "Sucatas", categories: ["Sucatas"] },
  todas: { label: "Todas as categorias", categories: null },
} as const satisfies Record<CategoryOption, { label: string; categories: readonly string[] | null }>;
export const DEFAULT_CATEGORY: CategoryOption = "veiculos";

/**
 * Condição declarada pelo leiloeiro. "Sem monta" inclui o lote que não informa nada (a maioria, em geral recuperado de
 * financiamento): a fonte não diz que não há dano, então a tela chama de "não informada", nunca de "sem dano".
 */
export const CONDITION_KEYS = ["qualquer", "sem-monta", "ate-pequena", "ate-media", "com-monta"] as const;
export type ConditionOption = (typeof CONDITION_KEYS)[number];

export const CONDITION_OPTIONS = {
  qualquer: { label: "Qualquer condição", filter: null },
  "sem-monta": { label: "Sem monta ou sucata informada", filter: { unclassified: true, levels: [] } },
  "ate-pequena": { label: "Até pequena monta", filter: { unclassified: true, levels: ["small"] } },
  "ate-media": { label: "Até média monta", filter: { unclassified: true, levels: ["small", "medium"] } },
  "com-monta": { label: "Só com monta", filter: { unclassified: false, levels: ["small", "medium", "large"] } },
} as const satisfies Record<
  ConditionOption,
  { label: string; filter: { unclassified: boolean; levels: readonly DamageLevel[] } | null }
>;
export const DEFAULT_CONDITION: ConditionOption = "qualquer";

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
