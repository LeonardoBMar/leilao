import { z } from "zod";

/**
 * Consulta interna `PDO/updateCountdown.php` do Detran-MG (a mesma que a tela usa a cada segundo): situação, valor e
 * tempo restante de vários lotes numa resposta. `arrematante` vem mascarado pelo próprio site ("xxx.xxx.xxx-xx") e
 * só interessa saber se existe; não é guardado.
 */
export const detranLiveLotSchema = z.looseObject({
  /** 1 e 2 em andamento, 3 e 5 encerrado, 4 cancelado (`js/Lotes/update.js` do site). */
  status: z.coerce.string(),
  /** Lance atual ou, sem lance, o valor inicial; nulo no lote encerrado sem lance. */
  valor: z.string().nullish(),
  valorIncremento: z.string().nullish(),
  arrematante: z.string().nullish(),
  /** Segundos até o fim; só em lote aberto. */
  tempo: z.number().nullish(),
});
export type DetranLiveLot = z.infer<typeof detranLiveLotSchema>;

/** Sem nenhum lote conhecido, o PHP do site devolve `[]` em vez de objeto vazio. */
export const detranLiveResponseSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()).transform((): Record<string, unknown> => ({})),
]);
