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

export function sumCents(values: readonly Cents[]): Cents {
  return cents(values.reduce<number>((total, value) => total + value, 0));
}

/** Taxa em pontos-base inteiros: 500 = 5,00%. Faixa aceita: 0 a 10.000 (SPEC §7.6). */
export type Bps = number & { readonly __brand: "Bps" };

export const MAX_BPS = 10_000;

export function bps(value: number): Bps {
  if (!Number.isInteger(value) || value < 0 || value > MAX_BPS) {
    throw new RangeError(`Pontos-base devem ser inteiros entre 0 e ${MAX_BPS}: ${value}`);
  }
  return value as Bps;
}

/** Converte percentual digitado ("5", "5,25", "5,25%") para pontos-base. */
export function parsePercent(input: string): Bps | null {
  const normalized = input.replace(/%|\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return value <= MAX_BPS ? bps(value) : null;
}

/**
 * Aplica uma taxa a um valor não negativo, arredondando half-up para o centavo (SPEC §7.6).
 * Aritmética inteira: sem ponto flutuante no produto taxa × valor.
 */
export function applyRate(amount: Cents, rate: Bps): Cents {
  if (amount < 0) throw new RangeError(`applyRate espera valor não negativo: ${amount}`);
  return cents(Math.floor((amount * rate + MAX_BPS / 2) / MAX_BPS));
}
