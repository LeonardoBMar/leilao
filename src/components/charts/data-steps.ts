import { linearScale } from "@/lib/charts";

/** Passo da escala sequencial (DESIGN.md §3.1, `data-1` a `data-5`). */
export type DataStep = 1 | 2 | 3 | 4 | 5;

export const DATA_STEPS: readonly DataStep[] = [1, 2, 3, 4, 5];

/** Fundo e texto de cada passo: os dois claros com tinta, os três escuros com branco (contraste ≥ 5:1). */
export const STEP_CLASSES = {
  1: "bg-data-1 text-foreground",
  2: "bg-data-2 text-foreground",
  3: "bg-data-3 text-white",
  4: "bg-data-4 text-white",
  5: "bg-data-5 text-white",
} as const satisfies Record<DataStep, string>;

/** Passo válido a partir de um número qualquer (a escala devolve 1 a 5). */
export function toDataStep(value: number): DataStep {
  return DATA_STEPS.find((step) => step === Math.round(value)) ?? (value < 1 ? 1 : 5);
}

/**
 * Posição em % (0 a 100, presa às bordas) de um valor no domínio, para posicionar marcas em CSS. Três casas bastam e
 * evitam levar ruído de ponto flutuante ("10.000000000002%") para o HTML.
 */
export function percentOf(value: number, [min, max]: readonly [number, number]): number {
  const position = Math.min(100, Math.max(0, linearScale([min, max], [0, 100])(value)));
  return Math.round(position * 1000) / 1000;
}
