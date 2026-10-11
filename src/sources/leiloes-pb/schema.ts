import { z } from "zod";

/** Data como o PHP do site serializa: `{ date: "2026-10-02 14:27:59.000000", timezone: "America/Fortaleza" }`. */
const siteDateSchema = z.object({ date: z.string(), timezone: z.string() }).nullable();

const moneySchema = z.union([z.number(), z.string()]).nullable();

/**
 * Parte do `var lote = {…}` da página do lote que o adaptador lê. O objeto traz também os lances (com IP e apelido de
 * quem deu o lance) e o arremate (com o apelido do comprador): esses campos não estão aqui e nunca são lidos.
 */
export const leiloesPbPageLotSchema = z.object({
  id: z.number().int(),
  numero: z.number().int().nullable(),
  descricao: z.string().nullable(),
  status: z.number().int().nullable(),
  dataFechamento: siteDateSchema,
  valorLanceAtual: moneySchema,
  valorArremate: moneySchema,
  valorInicial: moneySchema,
  valorMercado: moneySchema,
  totalLances: z.number().int().nullable(),
  taxasCalculadas: z
    .array(
      z.object({
        valor: moneySchema,
        imposto: z.object({ nome: z.string().nullable(), tipo: z.number().int().nullable(), valor: moneySchema }),
      }),
    )
    .nullable()
    .catch(null),
  leilao: z.object({
    id: z.number().int(),
    codigo: z.string().nullable(),
    titulo: z.string().nullable(),
    data1: siteDateSchema,
  }),
});
export type LeiloesPbPageLot = z.infer<typeof leiloesPbPageLotSchema>;

const dateTextSchema = z.object({ date: z.string(), timezone: z.string() }).nullable();

/**
 * Dado bruto guardado em `listings.raw`: o que a página do lote diz, sem nada de quem deu lance ou arrematou. A
 * descrição já vem sem placa, chassi, Renavam e número do sinistro. `detailsFromRaw` e a revisita partem daqui.
 */
export const leiloesPbRawSchema = z.object({
  lotId: z.string(),
  auctionId: z.string(),
  auctionCode: z.string().nullable(),
  auctionTitle: z.string().nullable(),
  auctionStartsAt: dateTextSchema,
  lotNumber: z.string().nullable(),
  /** Título do lote como o site escreve ("(SUCATA) TOYOTA / COROLLA … 2025/2026"). */
  title: z.string(),
  /** Linhas da descrição, sem a primeira (comitente, lote e data). */
  description: z.array(z.string()),
  seller: z.string().nullable(),
  statusCode: z.number().int().nullable(),
  closedAt: dateTextSchema,
  /** Valores em reais como o site manda (número ou texto "24800.00"). */
  finalBid: z.string().nullable(),
  currentBid: z.string().nullable(),
  bidCount: z.number().int().nullable(),
  minimumBid: z.string().nullable(),
  marketValue: z.string().nullable(),
  /** Comissão do leiloeiro em % ("5"); `null` quando a página não traz. */
  commissionPercent: z.string().nullable(),
  /** Taxas fixas do lote (logística, administrativa), em reais. */
  fixedFees: z.array(z.string()),
  photos: z.array(z.string()),
});
export type LeiloesPbRaw = z.infer<typeof leiloesPbRawSchema>;
