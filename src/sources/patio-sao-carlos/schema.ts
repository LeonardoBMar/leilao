import { z } from "zod";

/**
 * Consulta interna `atualizar_leiloes.php` do Pátio (a mesma que o site usa para atualizar o lance na tela): situação,
 * lance e datas de vários lotes numa resposta. Só os campos usados; o resto passa sem validação.
 * Não guardamos `lances_cadastro` (apelido de quem deu o último lance).
 */
const dateParts = z.object({
  dia: z.string(),
  mes: z.string(),
  ano: z.string(),
  hora: z.string(),
  min: z.string(),
  seg: z.string(),
});

export const patioLiveLotSchema = z.looseObject({
  box_id: z.coerce.string(),
  nome: z.string(),
  /** 0 em breve, 1 aberto, 2 arrematado, 3 não arrematado, 10 condicional, 20 venda direta (eventos.js do site). */
  situacao: z.coerce.number().int(),
  count_lances: z.coerce.number().int().nonnegative(),
  /** Id do leilão no site (o da URL `/lotes/leilao/{id}/`). */
  leiloes: z.coerce.string(),
  local: z.string().nullish(),
  categorias: z.string().nullish(),
  lance: z.object({ ini: z.string().nullish(), atual: z.string().nullish() }),
  cronometro: z.object({ data: z.object({ ini: dateParts, fim: dateParts }) }),
});
export type PatioLiveLot = z.infer<typeof patioLiveLotSchema>;
export type PatioDateParts = z.infer<typeof dateParts>;

/** Sem nenhum lote, o PHP do site devolve `item: []` em vez de objeto vazio. */
export const patioLiveResponseSchema = z.object({
  item: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown()).transform(() => ({}))]),
});
