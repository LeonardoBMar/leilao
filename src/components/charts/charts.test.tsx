import type { Route } from "next";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChartDataTable } from "./chart-data-table";
import { percentOf, toDataStep } from "./data-steps";
import { DistributionChart } from "./distribution-chart";
import { LineBand } from "./line-band";
import { RangeBars } from "./range-bars";
import { ScatterPlot } from "./scatter-plot";
import { TileGrid, TileLegend } from "./tile-grid";

const pct = (value: number) => `${Math.round(value * 100)}%`;

describe("percentOf e toDataStep", () => {
  it("posição em % presa às bordas", () => {
    expect(percentOf(0.5, [0, 1])).toBe(50);
    expect(percentOf(2, [0, 1])).toBe(100);
    expect(percentOf(-1, [0, 1])).toBe(0);
  });

  it("passo válido de 1 a 5", () => {
    expect(toDataStep(3)).toBe(3);
    expect(toDataStep(0)).toBe(1);
    expect(toDataStep(9)).toBe(5);
  });
});

describe("DistributionChart", () => {
  const html = renderToStaticMarkup(
    <DistributionChart
      ariaLabel="Sem monta declarada: mediana 49%"
      axisMax={1}
      ticks={[0, 0.5, 1]}
      formatValue={pct}
      rows={[
        {
          key: "sem-monta",
          label: "Sem monta declarada",
          detail: "737 vendas",
          bins: [0, 2, 4, 0],
          summary: { low: 0.4, median: 0.49, high: 0.57 },
          emphasis: true,
        },
        { key: "pequena", label: "Pequena monta", detail: "sem base (3 de 5)", bins: [1, 0, 2, 0], summary: null },
      ]}
    />,
  );

  it("é uma imagem com resumo em texto", () => {
    expect(html).toMatch(/role="img" aria-label="Sem monta declarada: mediana 49%"/);
  });

  it("desenha só as faixas com venda, e a mediana só com amostra", () => {
    expect(html.match(/<rect/g)).toHaveLength(4);
    expect(html.match(/left:49%/g)).toHaveLength(1);
    expect(html).toContain(">49%<");
  });
});

describe("TileGrid", () => {
  const html = renderToStaticMarkup(
    <TileGrid
      ariaLabel="Mediana por estado"
      columns={7}
      rows={8}
      tiles={[
        {
          key: "SP",
          column: 2,
          row: 4,
          label: "SP",
          value: "43%",
          caption: "297",
          tone: { kind: "colored", step: 2 },
          href: "/pesquisa?uf=SP" as Route,
          ariaLabel: "São Paulo: mediana 43%, 297 vendas",
          selected: true,
        },
        { key: "MT", column: 2, row: 2, label: "MT", value: "2", tone: { kind: "few" }, ariaLabel: "Mato Grosso: 2" },
        { key: "AC", column: 0, row: 2, label: "AC", tone: { kind: "empty" }, ariaLabel: "Acre: sem vendas" },
      ]}
    />,
  );

  it("posiciona cada estado na grade", () => {
    expect(html).toContain("grid-column-start:3;grid-row-start:5");
  });

  it("o estado com amostra tem a cor do passo, link e marca de selecionado", () => {
    expect(html).toMatch(/<a[^>]*aria-label="São Paulo: mediana 43%, 297 vendas"/);
    expect(html).toMatch(/<a[^>]*href="\/pesquisa\?uf=SP"/);
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("bg-data-2");
  });

  it("poucas vendas e nenhuma venda ficam sem cor", () => {
    expect(html).toContain("bg-surface-subtle");
    expect(html).toContain("border-border-strong");
  });

  it("a legenda mostra os passos e os casos sem cor", () => {
    const legend = renderToStaticMarkup(
      <TileLegend
        title="Mediana do % do valor de mercado"
        items={[
          { key: "1", swatch: 1, label: "35–40%" },
          { key: "few", swatch: "few", label: "1 a 4 vendas" },
        ]}
      />,
    );
    expect(legend).toContain("bg-data-1");
    expect(legend).toContain("1 a 4 vendas");
  });
});

describe("RangeBars", () => {
  it("cada linha leva ao filtro, com a faixa na escala comum", () => {
    const html = renderToStaticMarkup(
      <RangeBars
        ariaLabel="Modelos"
        domain={[0, 1]}
        rows={[
          {
            key: "PEUGEOT|207",
            label: "Peugeot 207",
            low: 0.2,
            median: 0.21,
            high: 0.25,
            valueLabel: "21%",
            detail: "5 vendas",
            href: "/pesquisa?marca=PEUGEOT&modelo=207" as Route,
            ariaLabel: "Peugeot 207: mediana 21%, 5 vendas",
          },
        ]}
      />,
    );
    expect(html).toMatch(/href="\/pesquisa\?marca=PEUGEOT&amp;modelo=207"/);
    expect(html).toContain("left:20%;width:5%");
    expect(html).toContain("left:21%");
  });
});

describe("ScatterPlot", () => {
  it("espalha pontos do mesmo ano e marca a mediana", () => {
    const html = renderToStaticMarkup(
      <ScatterPlot
        ariaLabel="Lance final por ano"
        xValues={[2019, 2020]}
        yDomain={[0, 100]}
        yTicks={[0, 50, 100]}
        formatY={String}
        points={[
          { key: "a", x: 2019, y: 40, title: "a" },
          { key: "b", x: 2019, y: 60, title: "b" },
          { key: "c", x: 2020, y: 50, title: "c" },
        ]}
        medians={[{ x: 2019, y: 50 }]}
      />,
    );
    // Domínio 2018,5–2020,5: 2019 ± 0,3 → 10% e 40%; 2020 → 75%.
    expect(html).toContain("left:10%;bottom:40%");
    expect(html).toContain("left:40%;bottom:60%");
    expect(html).toContain("left:75%;bottom:50%");
    expect(html).toContain("bg-foreground");
  });
});

describe("LineBand", () => {
  it("faixa, linha e valor escrito só nas pontas", () => {
    const html = renderToStaticMarkup(
      <LineBand
        ariaLabel="Lance antes do fim"
        yDomain={[0.8, 1]}
        yTicks={[0.8, 0.9, 1]}
        formatY={pct}
        points={[
          { key: "48", label: "48 h", low: 0.85, median: 0.9, high: 0.95 },
          { key: "24", label: "24 h", low: 0.9, median: 0.94, high: 0.97 },
          { key: "1", label: "1 h", low: 0.97, median: 0.99, high: 1 },
        ]}
      />,
    );
    expect(html).toContain("<polygon");
    expect(html).toContain("<polyline");
    expect(html).toContain(">90%<");
    expect(html).toContain(">99%<");
    expect(html).not.toContain(">94%<");
  });
});

describe("ChartDataTable", () => {
  it("fica fechada e mostra travessão no vazio", () => {
    const html = renderToStaticMarkup(
      <ChartDataTable
        columns={[
          { key: "state", label: "Estado" },
          { key: "median", label: "Mediana", align: "right" },
        ]}
        rows={[{ key: "AC", state: "Acre" }]}
      />,
    );
    expect(html).toMatch(/<details[^>]*>(?!.*open)/);
    expect(html).toContain("Ver dados em tabela");
    expect(html).toContain(">—<");
  });
});
