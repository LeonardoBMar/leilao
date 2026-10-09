import { describe, expect, it } from "vitest";

import { DEFAULT_RESEARCH_FILTERS } from "@/domain/research/filters";
import { buildStateSummaries } from "@/domain/research/states";

import { stateMapRegions } from "./state-regions";

const view = {
  metric: "ratio" as const,
  states: buildStateSummaries({
    SP: { n: 297, p25: 0.36, median: 0.43, p75: 0.5 },
    GO: { n: 233, p25: 0.5, median: 0.56, p75: 0.62 },
    MT: { n: 2, p25: 0.4, median: 0.45, p75: 0.5 },
  }),
};

describe("stateMapRegions", () => {
  const { regions, legend } = stateMapRegions(view, { ...DEFAULT_RESEARCH_FILTERS, state: "SP" });
  const region = (state: string) => regions.find((item) => item.state === state);

  it("estado com amostra: cor pela mediana, valor, dica e link que limpa a UF já escolhida", () => {
    expect(region("SP")).toMatchObject({
      value: "43%",
      tone: { kind: "colored", step: 1 },
      selected: true,
      href: "/pesquisa",
      ariaLabel: "São Paulo: mediana 43% do valor de mercado, 297 vendas",
      tooltip: {
        title: "São Paulo",
        lines: [
          "Mediana 43% do valor de mercado",
          "Metade das vendas entre 36% e 50%",
          "297 vendas",
          "Clique para voltar ao Brasil",
        ],
      },
    });
    expect(region("GO")).toMatchObject({ tone: { kind: "colored", step: 5 }, href: "/pesquisa?uf=GO" });
  });

  it("poucas vendas: só a contagem, sem cor; nenhuma venda: sem link", () => {
    expect(region("MT")).toMatchObject({ value: "2", tone: { kind: "few" }, href: "/pesquisa?uf=MT" });
    expect(region("AC")).toMatchObject({ tone: { kind: "empty" }, href: undefined, ariaLabel: "Acre: nenhuma venda" });
  });

  it("a legenda mostra só os passos usados e os casos sem cor", () => {
    expect(legend.map((item) => item.label)).toEqual(["43%–46%", "53%–56%", "1 a 4 vendas", "nenhuma venda"]);
  });

  it("em lance final, o mapa escreve os milhares de reais e a dica leva o valor completo", () => {
    const price = stateMapRegions(
      {
        metric: "price",
        states: buildStateSummaries({ GO: { n: 15, p25: 3_500_000, median: 3_894_000, p75: 4_200_000 } }),
      },
      { ...DEFAULT_RESEARCH_FILTERS, vehicle: { brand: "CHEVROLET", model: "ONIX" }, metric: "price" },
    );
    const go = price.regions.find((item) => item.state === "GO");
    expect(go?.value).toBe("38,9");
    expect(price.legendTitle).toBe("Mediana do lance final, em milhares de R$");
    expect(go?.ariaLabel.replace(/\s/g, " ")).toBe("Goiás: mediana R$ 38,9 mil de lance final, 15 vendas");
  });
});
