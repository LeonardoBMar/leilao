import "server-only";

import { isDeepStrictEqual } from "node:util";

/**
 * Só as colunas cujo valor novo difere do gravado (D-81). A revisita que não muda nada deixa de regravar o anúncio
 * inteiro: coluna fora do SET mantém a tupla menor e o `raw` no TOAST sem cópia nova.
 *
 * Compara por valor: datas pelo instante, listas na ordem e JSON sem depender da ordem das chaves (o `jsonb` reordena).
 * Na dúvida, a coluna entra: gravar a mais é o lado seguro.
 */
export function changedFields<T extends Record<string, unknown>>(
  stored: { readonly [K in keyof T]: unknown },
  next: T,
): Partial<T> {
  const changes: Partial<T> = {};
  for (const key in next) {
    if (!isDeepStrictEqual(stored[key], next[key])) changes[key] = next[key];
  }
  return changes;
}
