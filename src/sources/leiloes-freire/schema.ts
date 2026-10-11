import { z } from "zod";

const moneySchema = z.union([z.number(), z.string()]).nullable();

/**
 * Lote como a página o publica (`:data-lote` e cada item de `:data-leilao.lotes`). O objeto traz também quem arrematou
 * (`arrematante_id`, `placa`, que é o apelido do arrematante) e a guia de pagamento: esses campos não estão aqui e nunca
 * são lidos.
 */
export const freirePageLotSchema = z.object({
  id: z.number().int(),
  leilao: z.number().int(),
  lote: z.string().nullable(),
  descricao: z.string().nullable(),
  nome: z.string().nullable(),
  valor_avaliacao: moneySchema,
  valor_lance_minimo: moneySchema,
  valor_lance: moneySchema,
  porcentagem_leiloeiro: moneySchema,
  midia: z.string().nullable(),
  situacao: z.number().int().nullable(),
  situacao_situacao: z.string().nullable(),
});
export type FreirePageLot = z.infer<typeof freirePageLotSchema>;

/** Leilão como a página o publica (`:data-leilao`), com todos os lotes. */
export const freirePageAuctionSchema = z.object({
  id: z.number().int(),
  titulo: z.string().nullable(),
  data_leilao: z.string().nullable(),
  data_fim_leilao: z.string().nullable(),
  situacao: z.number().int().nullable(),
  lotes: z.array(freirePageLotSchema),
});
export type FreirePageAuction = z.infer<typeof freirePageAuctionSchema>;

/**
 * Dado bruto guardado em `listings.raw`: o lote e o leilão como a página diz, sem quem arrematou. A descrição já vem sem
 * placa, chassi e Renavam (D-40). `detailsFromRaw` e a revisita partem daqui.
 */
export const freireRawSchema = z.object({
  lotId: z.string(),
  auctionId: z.string(),
  auctionTitle: z.string().nullable(),
  /** Instantes ISO do site (UTC). */
  auctionStartsAt: z.string().nullable(),
  auctionEndsAt: z.string().nullable(),
  auctionStatus: z.number().int().nullable(),
  /** "Local do Leilão" como a página escreve ("Pátio … - Rio Largo/AL"). */
  place: z.string().nullable(),
  lotNumber: z.string().nullable(),
  description: z.string(),
  statusCode: z.number().int().nullable(),
  statusText: z.string().nullable(),
  /** Valores em reais como o site manda ("26400.00"). */
  bid: z.string().nullable(),
  appraisal: z.string().nullable(),
  minimumBid: z.string().nullable(),
  commissionPercent: z.string().nullable(),
  photos: z.array(z.string()),
});
export type FreireRaw = z.infer<typeof freireRawSchema>;
