import { percentile } from "../listings/estimates";
import type { Cents } from "../money";

/**
 * Calibração (docs/PLANO-MERCADO.md §7): como as análises fixadas antes do desfecho se saíram frente ao arremate. Puro:
 * recebe os itens já sem vazamento (faixa da época só com vendas anteriores à fixação) e só descreve.
 */

/** Abaixo disso, a tela avisa que são poucos resultados para tirar conclusão. */
export const MIN_CALIBRATION_RESULTS = 10;

/** Taxa esperada do arremate dentro da faixa típica (P25–P75): metade, se as vendas comparáveis forem boas. */
export const EXPECTED_BAND_HIT_RATE = 0.5;

export type CalibrationInput = {
  /** Limite fixado; `null` sem lance viável. */
  limit: Cents | null;
  finalBid: Cents;
  band: { low: Cents; median: Cents; high: Cents } | null;
  category: string | null;
};

export type BandPlacement = "below" | "inside" | "above";

/** Onde o arremate caiu na faixa da época; nas pontas conta como dentro. */
export function bandPlacement(finalBid: Cents, band: { low: Cents; high: Cents }): BandPlacement {
  if (finalBid < band.low) return "below";
  return finalBid > band.high ? "above" : "inside";
}

/** Desvio do limite frente ao arremate, em fração do arremate: −0,12 é um limite 12% abaixo do arremate. */
export function limitDeviation(limit: Cents, finalBid: Cents): number {
  return (limit - finalBid) / finalBid;
}

export type CalibrationSummary = {
  /** Resultados considerados. */
  n: number;
  /** Com faixa da época, e quantos arremates caíram dentro dela (`rate` `null` sem nenhum com faixa). */
  band: { n: number; inside: number; rate: number | null };
  /**
   * Com limite viável: o desvio mediano do limite frente ao arremate (`null` sem nenhum) e quantos arremates ficaram
   * no limite ou abaixo dele (lotes que o limite alcançaria).
   */
  limit: { n: number; medianDeviation: number | null; reached: number };
};

export function summarizeCalibration(items: readonly CalibrationInput[]): CalibrationSummary {
  const banded = items.flatMap(({ finalBid, band }) => (band === null ? [] : [bandPlacement(finalBid, band)]));
  const inside = banded.filter((placement) => placement === "inside").length;
  const limited = items.flatMap(({ limit, finalBid }) => (limit === null ? [] : [{ limit, finalBid }]));
  const deviations = limited.map(({ limit, finalBid }) => limitDeviation(limit, finalBid)).toSorted((a, b) => a - b);
  return {
    n: items.length,
    band: { n: banded.length, inside, rate: banded.length === 0 ? null : inside / banded.length },
    limit: {
      n: limited.length,
      medianDeviation: deviations.length === 0 ? null : percentile(deviations, 0.5),
      reached: limited.filter(({ limit, finalBid }) => finalBid <= limit).length,
    },
  };
}

/** O resumo por categoria do anúncio (sem anúncio, `null`), da categoria com mais resultados para a com menos. */
export function calibrationByCategory(
  items: readonly CalibrationInput[],
): { category: string | null; summary: CalibrationSummary }[] {
  const groups = Map.groupBy(items, (item) => item.category);
  return [...groups.entries()]
    .map(([category, group]) => ({ category, summary: summarizeCalibration(group) }))
    .toSorted((a, b) => b.summary.n - a.summary.n || (a.category ?? "").localeCompare(b.category ?? ""));
}
