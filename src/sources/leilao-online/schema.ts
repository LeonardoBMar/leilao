import { z } from "zod";

/**
 * Dado bruto guardado em `listings.raw`: o que a página do lote e a lista do leilão dizem, como texto, sem nada de
 * quem deu lance (o site mostra o apelido mascarado; não é guardado). `detailsFromRaw` e a revisita partem daqui.
 */
export const leilaoOnlineRawSchema = z.object({
  lotId: z.string(),
  auctionId: z.string(),
  lotNumber: z.string().nullable(),
  /** Título do lote, sem o "veja o vídeo!!" da frente. */
  title: z.string(),
  /** Especificações do lote (o parágrafo do lote, sem o aviso padrão do leiloeiro). */
  specs: z.string().nullable(),
  statusCode: z.number().int().nullable(),
  statusText: z.string().nullable(),
  /** Hora do pregão como o site escreve ("2026-10-14 15:00:00", Brasília). */
  auctionAt: z.string().nullable(),
  minimumBid: z.string().nullable(),
  /** Último lance ("65.000,00"); `null` quando o site mostra "R$ -". */
  lastBid: z.string().nullable(),
  bidCount: z.number().int().nullable(),
  /** Hora do último lance ("06/10/2026 15:31:25"), só a data da primeira linha da tabela. */
  lastBidAt: z.string().nullable(),
  photos: z.array(z.string()),
  /** Categoria do filtro da lista do leilão (id e nome do site); `null` quando o lote não apareceu em nenhuma. */
  category: z.object({ id: z.string(), name: z.string() }).nullable(),
});
export type LeilaoOnlineRaw = z.infer<typeof leilaoOnlineRawSchema>;
