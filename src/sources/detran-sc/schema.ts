import { z } from "zod";

/**
 * Respostas da API JSON da plataforma Astavero, a mesma que a tela dos sites usa (docs/PLANO-COLETA.md §2.10). Os
 * objetos trazem mais campos do que estes; só o que o adaptador lê é validado, e o resto não é guardado.
 */

/** Lote em `POST /app/lotes`: a lista de todos os lotes abertos do site, de qualquer comitente. */
export const astaveroListedLotSchema = z.looseObject({
  id: z.string(),
  /** Id do leilão do lote. */
  leilao: z.string(),
  /** Comitente: "DEPARTAMENTO ESTADUAL DE TRÂNSITO" nos leilões do Detran-SC. */
  vara: z.string(),
});

export const astaveroListSchema = z.looseObject({
  lotes: z.array(z.unknown()),
  /** `count` é o total de lotes; a resposta traz todos de uma vez (sem paginação quando não se pede página). */
  pag: z.looseObject({ count: z.number().nullish() }).nullish(),
});

const reais = z.number().nonnegative();
const text = z.string().nullish();

/**
 * Lote em `POST /app/pregao/lote`. A lista de lances (`l`) traz nome, CPF, apelido e IP de quem deu o lance: só o valor é
 * lido. O comitente (`p`) e o dono do veículo (`w`) também ficam de fora.
 */
export const astaveroLotSchema = z.looseObject({
  _id: z.string(),
  lote: z.coerce.string(),
  nome: z.string(),
  status: z.string(),
  motivo: text,
  sucata: z.boolean().nullish(),
  /** Ficha em HTML: nome, ano, placa, motor, chassi. */
  detalhada: text,
  /** Valores em reais. `comissao` em porcentagem. */
  v: z.looseObject({
    avaliacao: reais.nullish(),
    primeira: reais.nullish(),
    incremento: reais.nullish(),
    comissao: reais.nullish(),
  }),
  /** Pátio onde o veículo está. */
  d: z.looseObject({ nome: text, cidade: text, uf: text, bairro: text, endereco: text }).nullish(),
  datas: z.looseObject({
    /** Início do pregão (os lotes fecham um a um a partir daí). */
    leilao: text,
    /** Abertura para lances. */
    inicial: text,
    /** Fechamento do lote; nulo enquanto aberto e no lote retirado. */
    encerrado: text,
  }),
  anexos: z.array(z.looseObject({ type: z.string(), private: z.boolean().nullish(), url: z.string() })).nullish(),
  l: z.array(z.looseObject({ valor: reais })).nullish(),
});
export type AstaveroLot = z.infer<typeof astaveroLotSchema>;

/** Id desconhecido volta `{"lote": null}`. */
export const astaveroLotResponseSchema = z.looseObject({ lote: z.unknown() });
