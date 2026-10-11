import { z } from "zod";

/**
 * Dado bruto guardado em `listings.raw`: o que a página do lote mostra, sem quem deu o último lance (apelido e UF de
 * origem nunca são lidos). A descrição já vem sem placa, chassi, Renavam e número do motor (D-40). `detailsFromRaw` e a
 * revisita partem daqui.
 */
export const lanceCertoRawSchema = z.object({
  /** Edital do leilão ("271026PRFVE"): faz parte da URL do lote. */
  edital: z.string(),
  lotId: z.string(),
  lotNumber: z.string().nullable(),
  /** "Status" da página: "Aberto", "Encerrado", "Suspenso"… */
  statusText: z.string().nullable(),
  /** Valor atual (o vencedor, depois do fim) e lance inicial, em centavos. */
  bid: z.number().int().nullable(),
  bidCount: z.number().int().nullable(),
  startingBid: z.number().int().nullable(),
  /** "TAXA ADMINISTRATIVA: R$ 650,00" da anotação do lote, em centavos. */
  adminFee: z.number().int().nullable(),
  /** "Data leilão" do lote (horário de Recife) como instante ISO. */
  endsAt: z.string().nullable(),
  /** Comitente do lote ("SPRF PE", "PREF MUNICIPAL DE IBIMIRIM/PE"); vazio em muitos leilões. */
  seller: z.string().nullable(),
  /** UF do leilão, tirada do texto da página dele ("DETRAN/RN", "… Caicó/RN"). */
  auctionState: z.string().nullable(),
  /** Anotação do lote (avisos de documentação, local do pátio). */
  notes: z.string().nullable(),
  description: z.string(),
  photos: z.array(z.string()),
});
export type LanceCertoRaw = z.infer<typeof lanceCertoRawSchema>;
