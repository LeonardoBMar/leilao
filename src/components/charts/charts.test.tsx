import type { Route } from "next";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { STATE_SHAPES } from "./brazil-geometry";
import { BrazilMap } from "./brazil-map";
import { ChartDataTable } from "./chart-data-table";
import { percentOf, toDataStep } from "./data-steps";
import { DistributionChart } from "./distribution-chart";
import { LineBand } from "./line-band";
import { MapLegend } from "./map-legend";
import { RangeBars } from "./range-bars";
import { ScatterPlot } from "./scatter-plot";
import { StepLine } from "./step-line";

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
      format="ratio"
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

  it("sem dica nativa: a dica própria só aparece com o ponteiro, e a legenda substitui a frase", () => {
    expect(html).not.toContain("<title>");
    expect(html).not.toContain('role="tooltip"');
    expect(html).toContain("metade do meio");
  });

  it("o rótulo com href aplica o grupo", () => {
    const linked = renderToStaticMarkup(
      <DistributionChart
        ariaLabel="x"
        axisMax={1}
        ticks={[0, 1]}
        format="ratio"
        rows={[{ key: "a", label: "Média monta", bins: [1], summary: null, href: "/mercado?condicao=media" }]}
      />,
    );
    expect(linked).toContain('href="/mercado?condicao=media"');
  });
});

describe("BrazilMap", () => {
  const tooltip = { title: "", lines: [] };
  const html = renderToStaticMarkup(
    <BrazilMap
      ariaLabel="Mediana por estado"
      regions={[
        {
          state: "SP",
          value: "43%",
          tone: { kind: "colored", step: 2 },
          href: "/mercado?uf=SP" as Route,
          ariaLabel: "São Paulo: mediana 43%, 297 vendas",
          selected: true,
          tooltip,
        },
        {
          state: "DF",
          value: "2",
          tone: { kind: "few" },
          href: "/mercado?uf=DF" as Route,
          ariaLabel: "DF",
          selected: false,
          tooltip,
        },
        { state: "AC", tone: { kind: "empty" }, ariaLabel: "Acre: nenhuma venda", selected: false, tooltip },
        { state: "ES", tone: { kind: "empty" }, ariaLabel: "Espírito Santo: nenhuma venda", selected: false, tooltip },
        { state: "SC", tone: { kind: "empty" }, ariaLabel: "Santa Catarina: nenhuma venda", selected: false, tooltip },
      ]}
    />,
  );

  it("o contorno tem os 27 estados", () => {
    expect(STATE_SHAPES).toHaveLength(27);
    expect(new Set(STATE_SHAPES.map((shape) => shape.state)).size).toBe(27);
  });

  it("desenha só os estados recebidos; o com venda é link, com cor do passo e marca de escolhido", () => {
    expect(html.match(/<path/g)).toHaveLength(5);
    expect(html).toMatch(/<a[^>]*href="\/mercado\?uf=SP"/);
    expect(html).toMatch(/<a[^>]*aria-label="São Paulo: mediana 43%, 297 vendas"/);
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("fill-data-2");
    expect(html).toContain(">43%<");
  });

  it("estado pequeno com venda ganha linha guia; sem venda fica só o contorno, sem link", () => {
    expect(html.match(/<line/g)).toHaveLength(1);
    expect(html).toMatch(/<g role="img" aria-label="Acre: nenhuma venda"/);
    expect(html).toContain("fill-surface stroke-border-strong");
  });

  it("estado de rótulo externo sem venda: só a sigla dentro quando ela cabe (SC), nada quando não cabe (ES)", () => {
    expect(html).toContain(">SC<");
    expect(html).not.toContain(">ES<");
  });

  it("a legenda mostra os passos e os casos sem cor", () => {
    const legend = renderToStaticMarkup(
      <MapLegend
        title="Mediana em % do valor de mercado"
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
            href: "/mercado?marca=PEUGEOT&modelo=207" as Route,
            ariaLabel: "Peugeot 207: mediana 21%, 5 vendas",
          },
        ]}
      />,
    );
    expect(html).toMatch(/href="\/mercado\?marca=PEUGEOT&amp;modelo=207"/);
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
        yTicks={[0, 50, 100].map((value) => ({ value, label: String(value) }))}
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

  it("escreve a dica de uso sob o gráfico, sem depender do mouse", () => {
    const html = renderToStaticMarkup(
      <ScatterPlot
        ariaLabel="Lance final por ano"
        xValues={[2019]}
        yDomain={[0, 100]}
        yTicks={[0, 100].map((value) => ({ value, label: String(value) }))}
        points={[{ key: "a", x: 2019, y: 40, title: "a" }]}
      />,
    );
    expect(html).toContain("Toque ou passe o mouse num ponto para ver a venda.");
  });

  it("desenha a diagonal y = x no trecho comum aos eixos", () => {
    const html = renderToStaticMarkup(
      <ScatterPlot
        ariaLabel="Limite × arremate"
        xAxis={{ domain: [0, 200], ticks: [] }}
        yDomain={[100, 200]}
        yTicks={[]}
        points={[{ key: "a", x: 150, y: 160, title: "a" }]}
        diagonal={{ label: "limite = arremate" }}
      />,
    );
    // De x = y = 100 (50%, base) a x = y = 200 (100%, topo).
    expect(html).toContain('x1="50" y1="100" x2="100" y2="0"');
    expect(html).toContain("limite = arremate");
  });
});

describe("LineBand", () => {
  it("faixa, linha e valor escrito só nas pontas", () => {
    const html = renderToStaticMarkup(
      <LineBand
        ariaLabel="Lance antes do fim"
        yDomain={[0.8, 1]}
        yTicks={[0.8, 0.9, 1]}
        format="ratio"
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

describe("ScatterPlot com eixo contínuo e destaque", () => {
  const html = renderToStaticMarkup(
    <ScatterPlot
      ariaLabel="Lance final por km"
      xAxis={{
        domain: [0, 100],
        ticks: [
          { value: 0, label: "0" },
          { value: 100, label: "100 mil" },
        ],
      }}
      yDomain={[0, 100]}
      yTicks={[0, 100].map((value) => ({ value, label: String(value) }))}
      points={[
        { key: "a", x: 25, y: 40, title: "a", highlighted: true },
        { key: "b", x: 25, y: 60, title: "b" },
      ]}
    />,
  );

  it("coloca o ponto onde o valor cai, sem espalhar os do mesmo x", () => {
    expect(html).toContain("left:25%;bottom:40%");
    expect(html).toContain("left:25%;bottom:60%");
  });

  it("escreve as marcas do eixo dadas por quem chama", () => {
    expect(html).toContain("100 mil");
  });

  it("com um grupo em destaque, ele escurece e os outros clareiam", () => {
    expect(html).toContain("bg-data-5");
    expect(html).toContain("bg-data-1");
    expect(html).not.toContain("bg-data-3");
  });
});

describe("ScatterPlot no celular", () => {
  it("com muitos anos, metade dos rótulos some abaixo de sm, mantendo o mais novo", () => {
    const years = Array.from({ length: 14 }, (_, index) => 2013 + index);
    const html = renderToStaticMarkup(
      <ScatterPlot
        ariaLabel="Lance por ano"
        xValues={years}
        yDomain={[0, 100]}
        yTicks={[0, 100].map((value) => ({ value, label: String(value) }))}
        points={[]}
      />,
    );
    expect(html.match(/hidden sm:block/g)).toHaveLength(7);
    expect(html).toMatch(/class="absolute top-1\.5[^"]*tabular-nums"[^>]*>2026</);
  });
});

describe("StepLine", () => {
  const html = renderToStaticMarkup(
    <StepLine
      ariaLabel="Lances da venda"
      xDomain={[-10, 0]}
      xTicks={[{ value: -10, label: "−10 h" }]}
      yDomain={[0, 100]}
      yTicks={[{ value: 0, label: "0" }]}
      reference={{ value: 80, label: "Valor de mercado" }}
      endLabel="R$ 50"
      points={[
        { key: "a", x: -10, y: 20, title: "R$ 20" },
        { key: "b", x: -5, y: 50, title: "R$ 50" },
      ]}
    />,
  );

  it("degraus sem interpolar, com o último valor até o fim do eixo", () => {
    expect(html).toContain('points="0,80 50,80 50,50 100,50"');
  });

  it("referência tracejada e o valor final escrito", () => {
    expect(html).toContain("Valor de mercado");
    expect(html).toContain(">R$ 50<");
  });
});
