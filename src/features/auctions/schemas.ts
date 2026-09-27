import { z } from "zod";

import { addDays, zonedStartOfDay } from "@/lib/dates";
import { entityId, optionalText, optionalUrl, requiredText, zonedDateTime } from "@/lib/schemas";

export const AUCTION_ORIGINS = ["detran", "insurer", "financial", "judicial", "other", "unknown"] as const;
export type AuctionOrigin = (typeof AUCTION_ORIGINS)[number];

export const AUCTION_STATUSES = ["scheduled", "in_progress", "finished", "cancelled"] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

export const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const; // prettier-ignore

/** Cadastro e edição de leilão (SPEC RF-01). */
export const auctionInputSchema = z.object({
  name: requiredText("Informe o nome do leilão.").max(200, "Use até 200 caracteres."),
  auctioneer: requiredText("Informe o organizador.").max(200, "Use até 200 caracteres."),
  origin: z.enum(AUCTION_ORIGINS, "Selecione a origem."),
  status: z.enum(AUCTION_STATUSES, "Selecione o status."),
  startsAt: zonedDateTime("Informe data e hora válidas."),
  city: optionalText().pipe(z.string().max(120, "Use até 120 caracteres.").optional()),
  state: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase() || undefined : value),
    z.enum(BRAZILIAN_STATES, "Informe a sigla de uma UF válida.").optional(),
  ),
  noticeUrl: optionalUrl(),
  platformUrl: optionalUrl(),
  notes: optionalText().pipe(z.string().max(5_000, "Use até 5.000 caracteres.").optional()),
});
export type AuctionInput = z.infer<typeof auctionInputSchema>;

export const auctionIdSchema = entityId();

export const AUCTIONS_PAGE_SIZE = 25;

const optionalParam = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional()
  .catch(undefined);

/**
 * Filtros da lista (`/leiloes?busca=…&origem=…`). Nunca lançam: valor inválido vira o padrão.
 * Nomes dos parâmetros em pt-BR, como as rotas.
 */
export const auctionFiltersSchema = z
  .object({
    busca: optionalParam.pipe(z.string().max(100).optional()).catch(undefined),
    origem: z.enum(AUCTION_ORIGINS).optional().catch(undefined),
    status: z.enum(AUCTION_STATUSES).optional().catch(undefined),
    de: optionalParam,
    ate: optionalParam,
    ordem: z.enum(["asc", "desc"]).catch("asc"),
    arquivados: z
      .literal("1")
      .optional()
      .catch(undefined)
      .transform((value) => value === "1"),
    pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
  })
  .transform(({ busca, origem, status, de, ate, ordem, arquivados, pagina }) => ({
    search: busca,
    origin: origem,
    status,
    from: de && zonedStartOfDay(de) ? de : undefined,
    to: ate && zonedStartOfDay(ate) ? ate : undefined,
    sort: ordem,
    archived: arquivados,
    page: pagina,
  }));
export type AuctionFilters = z.infer<typeof auctionFiltersSchema>;

/** Intervalo UTC [início de `from`, início do dia seguinte a `to`) no fuso do app. */
export function periodRange(filters: Pick<AuctionFilters, "from" | "to">): { gte?: Date; lt?: Date } {
  const gte = filters.from ? zonedStartOfDay(filters.from) : null;
  const next = filters.to ? addDays(filters.to, 1) : null;
  const lt = next ? zonedStartOfDay(next) : null;
  return { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) };
}
