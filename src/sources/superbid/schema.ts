import { z } from "zod";

/**
 * Respostas da API de ofertas do Superbid (`offer-query.superbid.net/offers/`), a mesma que a tela do site usa
 * (docs/PLANO-COLETA.md §2.11). Os objetos trazem muito mais campos do que estes; só o que o adaptador lê é validado,
 * e o resto não é guardado.
 */

/** Oferta na descoberta, pedida com `fieldList=id;endDateTime;manager` (~60 KB por página de 500). */
export const superbidListedOfferSchema = z.looseObject({
  id: z.number().int().positive(),
  /** Fim do lote em milissegundos desde a época. */
  endDateTime: z.number().nullish(),
  /** Quem opera o leilão; o da equipe técnica do site publica leilões de teste. */
  manager: z.looseObject({ id: z.number() }).nullish(),
});

export const superbidListSchema = z.looseObject({
  total: z.number().int().nonnegative(),
  offers: z.array(z.unknown()),
});

const reais = z.number().nonnegative();
const text = z.string().nullish();

/**
 * Oferta completa. `winnerBid` traz o id e o login (mascarado) de quem está vencendo: só a presença é lida. O
 * vendedor traz telefones: só o nome fantasia da empresa é lido.
 */
export const superbidOfferSchema = z.looseObject({
  id: z.number().int().positive(),
  lotNumber: z.number().nullish(),
  totalBids: z.number().int().nonnegative().nullish(),
  endDateTime: z.number().nullish(),
  price: reais.nullish(),
  offerStatus: z.looseObject({ statusCode: z.number().int(), removed: z.boolean().nullish() }),
  offerDetail: z.looseObject({ initialBidValue: reais.nullish() }).nullish(),
  winnerBid: z.record(z.string(), z.unknown()).nullish(),
  store: z.looseObject({ name: text }).nullish(),
  seller: z.looseObject({ company: z.array(z.looseObject({ fantasyName: text })).nullish() }).nullish(),
  manager: z.looseObject({ id: z.number() }).nullish(),
  auction: z.looseObject({
    id: z.number(),
    desc: text,
    /** "2026-10-09 16:54:00", no fuso pedido (`timeZoneId=America/Sao_Paulo`). */
    beginDate: text,
    endDate: text,
  }),
  product: z.looseObject({
    shortDesc: z.string(),
    /** Descrição em HTML, no formato de cada leiloeiro. */
    detailedDescription: text,
    brand: z.looseObject({ description: text }).nullish(),
    model: z.looseObject({ description: text }).nullish(),
    subCategory: z
      .looseObject({
        id: z.number(),
        description: text,
        category: z.looseObject({ id: z.number() }).nullish(),
      })
      .nullish(),
    /** `city` vem como "Jundiaí - SP"; `state` por extenso. */
    location: z.looseObject({ city: text, state: text, country: text }).nullish(),
    galleryJson: z.array(z.looseObject({ link: text, type: text })).nullish(),
  }),
  /** Despesas do lote além do lance (estadia, remoção), em reais. */
  paymentItems: z
    .array(
      z.looseObject({ value: reais.nullish(), mapDescriptionTranslator: z.looseObject({ pt_BR: text }).nullish() }),
    )
    .nullish(),
  groupOffer: z.looseObject({ commissionPercent: reais.nullish() }).nullish(),
  commercialCondition: z.looseObject({ auctioneerCommissionPercent: reais.nullish() }).nullish(),
});
export type SuperbidOffer = z.infer<typeof superbidOfferSchema>;
