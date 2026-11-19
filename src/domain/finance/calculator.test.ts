import { describe, expect, it } from "vitest";

import { bps, cents } from "@/domain/money";

import {
  type AnalysisInputs,
  calculateMaxBid,
  compareToFixedLimit,
  compareToLimit,
  type CompleteInputs,
  completeInputs,
  differenceToLimit,
  type MaxBidOutcome,
  missingFields,
  prepareFixedAnalysis,
  roomToFixedLimit,
  simulateBid,
} from "./calculator";

const reais = (value: number) => cents(Math.round(value * 100));

/** SPEC §7.3: comissão fixa. */
const fixedExample: AnalysisInputs = {
  marketValue: reais(50_000),
  repairCost: reais(5_000),
  documentationCost: reais(1_000),
  transportCost: reais(800),
  tiresCost: reais(0),
  serviceCost: reais(0),
  otherFees: reais(0),
  commissionMode: "fixed",
  commissionFixed: reais(2_000),
  commissionRateBps: null,
  riskReserve: reais(2_000),
  riskReserveRateBps: null,
  desiredMargin: reais(6_000),
  desiredMarginRateBps: null,
};

/** SPEC §7.4: mesmas premissas com 5% de comissão sobre o lance. */
const percentageExample: AnalysisInputs = {
  ...fixedExample,
  commissionMode: "percentage",
  commissionFixed: null,
  commissionRateBps: bps(500),
};

function complete(inputs: AnalysisInputs): CompleteInputs {
  const result = completeInputs(inputs);
  if (!result.ok) throw new Error(`entradas incompletas: ${result.missing.join(", ")}`);
  return result.value;
}

function viable(outcome: MaxBidOutcome) {
  if (outcome.kind !== "viable") throw new Error(`esperava lance viável, veio ${outcome.kind}`);
  return outcome;
}

describe("SPEC §7.3 — comissão fixa", () => {
  it("calcula o lance máximo de R$ 33.200,00", () => {
    const outcome = viable(calculateMaxBid(fixedExample));

    expect(outcome.maxBid).toBe(reais(33_200));
    expect(outcome.fixedCosts).toBe(reais(6_800));
    expect(outcome.commissionAtMaxBid).toBe(reais(2_000));
    expect(outcome.marginAtMaxBid).toBe(reais(6_000));
  });

  it("simula o lance de R$ 31.000,00", () => {
    const simulation = simulateBid(complete(fixedExample), reais(31_000));

    expect(simulation.costsBesidesBid).toBe(reais(8_800));
    expect(simulation.costsBesidesBid + reais(2_000)).toBe(reais(10_800));
    expect(simulation.totalCost).toBe(reais(41_800));
    expect(simulation.estimatedMargin).toBe(reais(8_200));
    expect(differenceToLimit(reais(33_200), reais(31_000))).toBe(reais(2_200));
  });
});

describe("SPEC §7.4 — comissão percentual", () => {
  it("calcula o lance máximo de R$ 33.523,81 após ajustar o arredondamento da comissão", () => {
    const outcome = viable(calculateMaxBid(percentageExample));

    expect(outcome.maxBid).toBe(reais(33_523.81));
    expect(outcome.commissionAtMaxBid).toBe(reais(1_676.19));
    expect(outcome.totalAtMaxBid).toBe(reais(44_000));
    expect(outcome.marginAtMaxBid).toBe(reais(6_000));
  });

  it("não aceita o centavo seguinte ao limite", () => {
    const inputs = complete(percentageExample);
    const next = simulateBid(inputs, reais(33_523.82));

    expect(next.totalCost + inputs.desiredMargin).toBeGreaterThan(inputs.marketValue);
  });
});

describe("comissão percentual — arredondamento", () => {
  const withRate = (rate: number, bid: number) =>
    simulateBid(complete({ ...percentageExample, commissionRateBps: bps(rate) }), cents(bid)).commission;

  it.each([
    // [bps, lance em centavos, comissão esperada em centavos]
    [500, 10, 1], // 0,5 centavo → arredonda para cima
    [500, 9, 0], // 0,45 centavo → para baixo
    [250, 20, 1], // 0,5 centavo
    [1, 5_000, 1], // 0,01% de R$ 50,00 = 0,5 centavo
    [10_000, 12_345, 12_345], // 100%
    [0, 99_999, 0],
  ])("%i bps sobre %i centavos = %i centavos", (rate, bid, expected) => {
    expect(withRate(rate, bid)).toBe(expected);
  });
});

describe("sem lance viável", () => {
  it("quando custos, reserva e margem consomem todo o valor de mercado (orçamento zero)", () => {
    const outcome = calculateMaxBid({ ...fixedExample, desiredMargin: reais(39_200) });

    expect(outcome).toEqual({ kind: "not_viable", fixedCosts: reais(6_800) });
  });

  it("quando sobra exatamente 1 centavo, o lance de 1 centavo é viável", () => {
    const outcome = viable(calculateMaxBid({ ...fixedExample, desiredMargin: reais(39_199.99) }));

    expect(outcome.maxBid).toBe(1);
  });

  it("com comissão percentual, quando nem 1 centavo cabe após a comissão", () => {
    const outcome = calculateMaxBid({ ...percentageExample, marketValue: reais(14_800), desiredMargin: reais(6_000) });

    expect(outcome.kind).toBe("not_viable");
  });
});

describe("entradas incompletas", () => {
  it("lista o que falta sem tratar ausência como zero", () => {
    const outcome = calculateMaxBid({ ...fixedExample, tiresCost: null, riskReserve: null });

    expect(outcome).toEqual({ kind: "incomplete", missing: ["tiresCost", "riskReserve"] });
  });

  it("exige o valor da modalidade de comissão escolhida", () => {
    expect(missingFields({ ...fixedExample, commissionFixed: null })).toEqual(["commissionFixed"]);
    expect(missingFields({ ...percentageExample, commissionRateBps: null })).toEqual(["commissionRateBps"]);
    expect(missingFields({ ...fixedExample, commissionMode: null })).toEqual(["commissionMode"]);
  });

  it("ignora o valor da modalidade desativada", () => {
    const outcome = viable(calculateMaxBid({ ...fixedExample, commissionRateBps: bps(9_999) }));

    expect(outcome.maxBid).toBe(reais(33_200));
  });
});

describe("invariantes", () => {
  it("recusa entradas negativas", () => {
    expect(() => calculateMaxBid({ ...fixedExample, repairCost: cents(-1) })).toThrow(RangeError);
  });

  it("recusa lance simulado negativo", () => {
    expect(() => simulateBid(complete(fixedExample), cents(-1))).toThrow(RangeError);
  });

  it("o lance máximo é sempre o maior centavo que cabe no orçamento", () => {
    // Gerador determinístico (Park–Miller): mesmas entradas em toda execução, sem estourar 2^53.
    let seed = 42;
    const random = (max: number) => {
      seed = (seed * 48_271) % 2_147_483_647;
      return seed % max;
    };

    for (let i = 0; i < 1_000; i++) {
      const isPercentage = random(2) === 0;
      const inputs = complete({
        ...fixedExample,
        marketValue: cents(random(20_000_000)),
        repairCost: cents(random(1_000_000)),
        documentationCost: cents(random(300_000)),
        commissionMode: isPercentage ? "percentage" : "fixed",
        commissionFixed: isPercentage ? null : cents(random(500_000)),
        commissionRateBps: isPercentage ? bps(random(10_001)) : null,
        riskReserve: cents(random(500_000)),
        desiredMargin: cents(random(2_000_000)),
      });
      const fits = (bid: number) =>
        simulateBid(inputs, cents(bid)).totalCost + inputs.desiredMargin <= inputs.marketValue;
      const outcome = calculateMaxBid({
        ...fixedExample,
        marketValue: inputs.marketValue,
        repairCost: cents(inputs.fixedCosts),
        documentationCost: cents(0),
        transportCost: cents(0),
        commissionMode: inputs.commission.mode,
        commissionFixed: inputs.commission.mode === "fixed" ? inputs.commission.amount : null,
        commissionRateBps: inputs.commission.mode === "percentage" ? inputs.commission.rate : null,
        riskReserve: inputs.riskReserve,
        desiredMargin: inputs.desiredMargin,
      });

      if (outcome.kind === "viable") {
        expect(fits(outcome.maxBid)).toBe(true);
        expect(fits(outcome.maxBid + 1)).toBe(false);
      } else {
        expect(fits(1)).toBe(false);
      }
    }
  });
});

describe("compareToLimit — SPEC §7.5", () => {
  const outcome = calculateMaxBid(fixedExample);

  it.each([
    [reais(31_000), "below_limit"],
    [reais(33_200), "at_limit"],
    [reais(33_200.01), "above_limit"],
  ] as const)("lance %i centavos → %s", (bid, expected) => {
    expect(compareToLimit(outcome, bid)).toBe(expected);
  });

  it("sem lance viável", () => {
    expect(compareToLimit(calculateMaxBid({ ...fixedExample, desiredMargin: reais(50_000) }), reais(1))).toBe(
      "no_viable_bid",
    );
  });

  it("comparação indisponível sem lance ou com análise incompleta", () => {
    expect(compareToLimit(outcome, null)).toBe("unavailable");
    expect(compareToLimit(calculateMaxBid({ ...fixedExample, marketValue: null }), reais(1))).toBe("unavailable");
  });
});

describe("compareToFixedLimit", () => {
  it("compara com o limite preservado na análise fixada", () => {
    const limit = { isViable: true, maxBid: reais(33_200) } as const;
    expect(compareToFixedLimit(limit, reais(38_500))).toBe("above_limit");
    expect(compareToFixedLimit(limit, reais(33_200))).toBe("at_limit");
    expect(compareToFixedLimit({ isViable: false }, reais(1))).toBe("no_viable_bid");
    expect(compareToFixedLimit(null, reais(1))).toBe("unavailable");
    expect(compareToFixedLimit(limit, null)).toBe("unavailable");
  });
});

describe("reserva e margem em % do valor de venda (D-38)", () => {
  it("4% e 12% de R$ 50.000 dão o mesmo limite que R$ 2.000 e R$ 6.000", () => {
    const byRate = calculateMaxBid({
      ...fixedExample,
      riskReserve: null,
      riskReserveRateBps: bps(400),
      desiredMargin: null,
      desiredMarginRateBps: bps(1_200),
    });
    expect(byRate).toEqual(calculateMaxBid(fixedExample));
  });

  it("o % tem precedência sobre o valor em R$ e acompanha o valor de venda", () => {
    const inputs = { ...fixedExample, desiredMarginRateBps: bps(1_000) };
    const complete = completeInputs(inputs);
    expect(complete.ok && complete.value.desiredMargin).toBe(reais(5_000));
    const cheaper = completeInputs({ ...inputs, marketValue: reais(40_000) });
    expect(cheaper.ok && cheaper.value.desiredMargin).toBe(reais(4_000));
  });

  it("pendente só quando nem R$ nem % foram informados", () => {
    const inputs = { ...fixedExample, riskReserve: null, desiredMargin: null, desiredMarginRateBps: bps(1_500) };
    expect(missingFields(inputs)).toEqual(["riskReserve"]);
  });
});

describe("roomToFixedLimit", () => {
  it("limite menos lance, negativa acima do limite", () => {
    const limit = { isViable: true as const, maxBid: cents(1_000_000) };
    expect(roomToFixedLimit(limit, cents(800_000))).toBe(200_000);
    expect(roomToFixedLimit(limit, cents(1_100_000))).toBe(-100_000);
  });

  it("sem limite viável ou sem lance: nula", () => {
    expect(roomToFixedLimit(null, cents(1))).toBeNull();
    expect(roomToFixedLimit({ isViable: false }, cents(1))).toBeNull();
    expect(roomToFixedLimit({ isViable: true, maxBid: cents(1) }, null)).toBeNull();
  });
});

describe("prepareFixedAnalysis", () => {
  it("prepara análise viável calculando reserva e margem em centavos a partir de %", () => {
    const result = prepareFixedAnalysis({
      ...percentageExample,
      riskReserve: null,
      riskReserveRateBps: bps(500),
      desiredMargin: null,
      desiredMarginRateBps: bps(1_500),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isViable).toBe(true);
      expect(result.value.riskReserve).toBe(reais(2_500));
      expect(result.value.desiredMargin).toBe(reais(7_500));
      expect(result.value.maxBid).toBeGreaterThan(0);
      expect(result.value.totalAtMaxBid).not.toBeNull();
      expect(result.value.marginAtMaxBid).not.toBeNull();
    }
  });

  it("prepara análise completa porém inviável com saídas nulas", () => {
    const result = prepareFixedAnalysis({ ...fixedExample, desiredMargin: reais(45_000) });
    expect(result).toEqual({
      ok: true,
      value: {
        riskReserve: reais(2_000),
        desiredMargin: reais(45_000),
        isViable: false,
        maxBid: null,
        totalAtMaxBid: null,
        marginAtMaxBid: null,
      },
    });
  });

  it("rejeita análise incompleta ou com valor de mercado zerado", () => {
    expect(prepareFixedAnalysis({ ...fixedExample, marketValue: null })).toEqual({ ok: false, error: "incomplete" });
    expect(prepareFixedAnalysis({ ...fixedExample, repairCost: null })).toEqual({ ok: false, error: "incomplete" });
    expect(prepareFixedAnalysis({ ...fixedExample, marketValue: cents(0) })).toEqual({
      ok: false,
      error: "market_value_not_positive",
    });
  });
});
