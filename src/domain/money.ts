/**
 * Valor monetário em centavos inteiros. A marca impede misturar reais e centavos por engano:
 * um `number` qualquer só vira `Cents` pelas funções deste módulo.
 */
export type Cents = number & { readonly __brand: "Cents" };

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Centavos devem ser inteiros: ${value}`);
  return value as Cents;
}

/** Converte texto digitado em reais ("1.234,56", "R$ 1234,5", "1234") para centavos. */
export function parseBRL(input: string): Cents | null {
  const normalized = input
    .replace(/R\$|\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.replace("-", "").split(".");
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents(normalized.startsWith("-") ? -value : value);
}

/** Arredondamento half-up para o centavo mais próximo, usado em produtos como taxa × lance. */
export function roundCents(value: number): Cents {
  return cents(Math.sign(value) * Math.round(Math.abs(value)));
}
