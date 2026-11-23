import { z } from "zod";

import type { LimitComparison } from "@/domain/finance/calculator";
import {
  checkbox,
  entityId,
  optionalInt,
  optionalPositiveBrlAmount,
  optionalText,
  optionalUrl,
  requiredInt,
  requiredText,
} from "@/lib/schemas";

const YEAR_MESSAGE = "Informe um ano entre 1900 e 2100.";

/** Cadastro e edição de lote (SPEC RF-02, RF-03). O leilão vem do contexto (bind), não do formulário. */
export const lotInputSchema = z
  .object({
    // Número é texto ("0152", "152-A"), sem espaços externos; único por leilão.
    lotNumber: requiredText("Informe o número do lote.").max(30, "Use até 30 caracteres."),
    brand: requiredText("Informe a marca.").max(80, "Use até 80 caracteres."),
    model: requiredText("Informe o modelo.").max(80, "Use até 80 caracteres."),
    vehicleVersion: optionalText().pipe(z.string().max(120, "Use até 120 caracteres.").optional()),
    modelYear: requiredInt(1900, 2100, YEAR_MESSAGE),
    manufactureYear: optionalInt(1900, 2100, YEAR_MESSAGE),
    // Vazio = desconhecida; 0 = zero informado (RF-02).
    mileageKm: optionalInt(0, 5_000_000, "Informe a quilometragem em números inteiros."),
    startingBid: optionalPositiveBrlAmount(),
    currentBid: optionalPositiveBrlAmount(),
    lotUrl: optionalUrl(),
    isFollowed: checkbox(),
    notes: optionalText().pipe(z.string().max(5_000, "Use até 5.000 caracteres.").optional()),
  })
  // No Zod 4 a regra cruzada roda mesmo com campo inválido: só compara quando o ano-modelo é válido.
  .refine(
    (lot) =>
      lot.manufactureYear === undefined || !Number.isInteger(lot.modelYear) || lot.manufactureYear <= lot.modelYear,
    {
      path: ["manufactureYear"],
      message: "O ano de fabricação não pode ser posterior ao ano-modelo.",
    },
  );
export type LotInput = z.infer<typeof lotInputSchema>;

export const lotIdSchema = entityId();

/** Atualização rápida do lance atual na ficha (fluxo principal, passo 7). Vazio limpa o valor. */
export const currentBidInputSchema = z.object({ currentBid: optionalPositiveBrlAmount() });

export const LOTS_PAGE_SIZE = 25;
/** Leilões por página em "Minhas análises" por leilão. */
export const LOT_GROUPS_PAGE_SIZE = 10;

const presence = z.enum(["com", "sem"]).optional().catch(undefined);
const analysisFilter = z.enum(["com", "sem", "rascunho"]).optional().catch(undefined);
const flag = z
  .literal("1")
  .optional()
  .catch(undefined)
  .transform((value) => value === "1");

/** Lance atual frente ao limite fixado (`compareToFixedLimit`), como vai na URL. */
export const LOT_POSITION_KEYS = ["abaixo", "no-limite", "acima", "sem-viavel", "sem-comparacao"] as const;
export type LotPositionKey = (typeof LOT_POSITION_KEYS)[number];
export const LOT_POSITION_COMPARISONS = {
  abaixo: "below_limit",
  "no-limite": "at_limit",
  acima: "above_limit",
  "sem-viavel": "no_viable_bid",
  "sem-comparacao": "unavailable",
} as const satisfies Record<LotPositionKey, LimitComparison>;

export const LOT_SORT_KEYS = ["leilao", "folga", "atualizados"] as const;
export type LotSortKey = (typeof LOT_SORT_KEYS)[number];

export type LotFilters = {
  search: string | undefined;
  followedOnly: boolean;
  analysis: "com" | "sem" | "rascunho" | undefined;
  result: "com" | "sem" | undefined;
  archived: boolean;
  position: LotPositionKey | undefined;
  /** Leilão ainda por acontecer (início no futuro) ou já realizado. */
  timing: "proximos" | "realizados" | undefined;
  sort: LotSortKey;
  page: number;
};

/** Filtros da lista de lotes. Nunca lançam: valor inválido vira o padrão. */
export const lotFiltersSchema = z
  .object({
    busca: z
      .string()
      .trim()
      .max(100)
      .transform((value) => value || undefined)
      .optional()
      .catch(undefined),
    acompanhados: flag,
    analise: analysisFilter,
    resultado: presence,
    arquivados: flag,
    posicao: z.enum(LOT_POSITION_KEYS).optional().catch(undefined),
    leilao: z.enum(["proximos", "realizados"]).optional().catch(undefined),
    ordem: z.enum(LOT_SORT_KEYS).catch("leilao"),
    pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
  })
  .transform((input): LotFilters => ({
    search: input.busca,
    followedOnly: input.acompanhados,
    analysis: input.analise,
    result: input.resultado,
    archived: input.arquivados,
    position: input.posicao,
    timing: input.leilao,
    sort: input.ordem,
    page: input.pagina,
  }));

/** URL crua → filtros. Parâmetro repetido: vale o primeiro. */
export function parseLotParams(raw: Readonly<Record<string, string | string[] | undefined>>): LotFilters {
  return lotFiltersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])),
  );
}

/** Filtros → URL, sem padrões nem página (inverso de `parseLotParams`). */
export function lotParams(filters: LotFilters): Record<string, string> {
  const params: Record<string, string | undefined> = {
    busca: filters.search,
    acompanhados: filters.followedOnly ? "1" : undefined,
    analise: filters.analysis,
    resultado: filters.result,
    arquivados: filters.archived ? "1" : undefined,
    posicao: filters.position,
    leilao: filters.timing,
    ordem: filters.sort === "leilao" ? undefined : filters.sort,
  };
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])),
  );
}
