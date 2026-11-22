import { describe, expect, it } from "vitest";

import {
  BAND_POSITION_VARIANTS,
  bandHitSentence,
  deviationLabel,
  excludedLabel,
  limitSentence,
  listingCategoryLabel,
  mileageLabel,
  perWeekLabel,
  riseLabel,
} from "./labels";

describe("riseLabel", () => {
  it("sobe com mais, cai com menos", () => {
    expect(riseLabel(0.93)).toBe("+8%");
    expect(riseLabel(1)).toBe("+0%");
    expect(riseLabel(1.03)).toBe("−3%");
  });
});

describe("excludedLabel", () => {
  it("diz cada motivo com a contagem", () => {
    expect(excludedLabel({ noMarketValue: 1_506, outOfBounds: 3 })).toBe("1.506 sem FIPE · 3 com % fora de 1% a 200%");
    expect(excludedLabel({ noMarketValue: 0, outOfBounds: 2 })).toBe("2 com % fora de 1% a 200%");
  });

  it("sem venda de fora, nada", () => {
    expect(excludedLabel({ noMarketValue: 0, outOfBounds: 0 })).toBeNull();
  });
});

describe("mileageLabel", () => {
  it("em milhares de km", () => {
    expect(mileageLabel(100_000)).toBe("100 mil km");
  });
});

describe("perWeekLabel", () => {
  it("uma casa decimal e o piso de uma por semana", () => {
    expect(perWeekLabel(3.46)).toBe("3,5 por semana");
    expect(perWeekLabel(12)).toBe("12 por semana");
    expect(perWeekLabel(0.4)).toBe("menos de 1 por semana");
  });
});

describe("frases da Calibração", () => {
  const summary = {
    n: 26,
    band: { n: 26, inside: 11, rate: 11 / 26 },
    limit: { n: 24, medianDeviation: -0.123, reached: 5 },
  };

  it("taxa dentro da faixa e desvio do limite", () => {
    expect(bandHitSentence(summary)).toBe("Em 26 resultados, o arremate caiu dentro da faixa típica 11 vezes (42%).");
    expect(limitSentence(summary)).toBe("Seu limite ficou, na mediana, 12% abaixo do arremate.");
  });

  it("sem faixa ou sem limite, sem frase", () => {
    const empty = { n: 0, band: { n: 0, inside: 0, rate: null }, limit: { n: 0, medianDeviation: null, reached: 0 } };
    expect(bandHitSentence(empty)).toBeNull();
    expect(limitSentence(empty)).toBeNull();
  });

  it("desvio acima, abaixo e igual", () => {
    expect(deviationLabel(0.05)).toBe("5% acima do arremate");
    expect(deviationLabel(-0.004)).toBe("igual ao arremate");
  });

  it("categoria do anúncio", () => {
    expect(listingCategoryLabel("Utilitarios")).toBe("Utilitários");
    expect(listingCategoryLabel(null)).toBe("Sem anúncio");
  });
});

describe("BAND_POSITION_VARIANTS", () => {
  it("mantém abaixo/dentro neutros e destaca apenas acima da faixa", () => {
    expect(BAND_POSITION_VARIANTS.below).toBe("outline");
    expect(BAND_POSITION_VARIANTS.inside).toBe("default");
    expect(BAND_POSITION_VARIANTS.above).toBe("warning");
  });
});
