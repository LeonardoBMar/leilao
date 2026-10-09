/**
 * Escalas dos gráficos em SVG (D-45): números puros, sem DOM. Os componentes de `src/components/charts` só desenham o
 * que estas funções calculam.
 */

/** Função linear de um intervalo de dados para um intervalo de pixels. Domínio vazio vai para o início do range. */
export function linearScale(
  [domainStart, domainEnd]: readonly [number, number],
  [rangeStart, rangeEnd]: readonly [number, number],
): (value: number) => number {
  const span = domainEnd - domainStart;
  return (value) => (span === 0 ? rangeStart : rangeStart + ((value - domainStart) / span) * (rangeEnd - rangeStart));
}

/**
 * Marcas de eixo "redondas" de 0 até cobrir `max`, com cerca de `count` intervalos (passo 1, 2 ou 5 × 10ⁿ).
 * `max` ≤ 0 devolve só o zero.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 5, 10].find((factor) => factor * magnitude >= rough) ?? 10) * magnitude;
  const last = Math.ceil(max / step - 1e-9);
  // Arredonda para não carregar 0,30000000000000004 para o rótulo.
  return Array.from({ length: last + 1 }, (_, index) => Number((index * step).toPrecision(12)));
}

/**
 * Eixo que não começa no zero (ex.: 60% a 100%): início e fim arredondados para o passo "redondo" mais próximo, e as
 * marcas entre eles.
 */
export function niceRange(min: number, max: number, count = 4): { domain: [number, number]; ticks: number[] } {
  const span = max - min || Math.abs(max) || 1;
  const rough = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 5, 10].find((factor) => factor * magnitude >= rough) ?? 10) * magnitude;
  const first = Math.floor(min / step + 1e-9);
  // Início e fim iguais (todos os valores no mesmo passo): o eixo ganha um passo acima.
  const last = Math.max(first + 1, Math.ceil(max / step - 1e-9));
  const ticks = Array.from({ length: last - first + 1 }, (_, index) =>
    Number(((first + index) * step).toPrecision(12)),
  );
  return { domain: [ticks[0] ?? min, ticks.at(-1) ?? max], ticks };
}

/** Faixa de valores de um passo da escala sequencial (para a legenda). */
export type SequentialBand = { step: number; from: number; to: number };

export type SequentialScale = {
  /** Passo de 1 (mais claro) a `steps` (mais escuro). */
  step: (value: number) => number;
  bands: SequentialBand[];
};

/**
 * Escala sequencial em intervalos iguais entre o menor e o maior valor (mapa, D-45). Com todos os valores iguais, um
 * passo do meio só. Sem valores: `null` (nada a colorir).
 */
export function sequentialScale(values: readonly number[], steps: number): SequentialScale | null {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const middle = Math.ceil(steps / 2);
    return { step: () => middle, bands: [{ step: middle, from: min, to: max }] };
  }
  const width = (max - min) / steps;
  const bands = Array.from({ length: steps }, (_, index) => ({
    step: index + 1,
    from: min + index * width,
    to: index === steps - 1 ? max : min + (index + 1) * width,
  }));
  return {
    // O maior valor fecha o último passo em vez de abrir um sexto.
    step: (value) => Math.min(steps, Math.max(1, Math.floor((value - min) / width) + 1)),
    bands,
  };
}
