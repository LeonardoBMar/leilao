import { z } from "zod";

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
