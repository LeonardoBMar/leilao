import type { Cents } from "@/domain/money";
import { toMonthInput } from "@/lib/dates";
import { formatMoneyInput } from "@/lib/format";

/** FIPE do anúncio ligado ao lote: o valor, o mês da tabela e de onde veio (casada pelo sistema ou da fonte). */
export type ListingFipe = { value: Cents; refMonth: Date | null; source: string };

export type FipeField = "fipeValue" | "fipeReferenceMonth" | "fipeReferenceSource";

/**
 * "Usar FIPE do anúncio" (docs/PLANO-MERCADO.md §8, T3.4): os campos da referência FIPE que estão vazios no formulário,
 * preenchidos com a FIPE do anúncio. Nunca sobrescreve o que o usuário digitou.
 */
export function fipeFill(
  current: Readonly<Record<FipeField, string>>,
  fipe: ListingFipe,
): Partial<Record<FipeField, string>> {
  const values: Record<FipeField, string | null> = {
    fipeValue: formatMoneyInput(fipe.value),
    fipeReferenceMonth: fipe.refMonth === null ? null : toMonthInput(fipe.refMonth),
    fipeReferenceSource: fipe.source,
  };
  const fill: Partial<Record<FipeField, string>> = {};
  for (const field of ["fipeValue", "fipeReferenceMonth", "fipeReferenceSource"] as const) {
    const value = values[field];
    if (value !== null && current[field].trim() === "") fill[field] = value;
  }
  return fill;
}
