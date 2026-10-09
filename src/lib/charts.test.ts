import { describe, expect, it } from "vitest";

import { linearScale, niceTicks, sequentialScale } from "./charts";

describe("linearScale", () => {
  it("leva o domínio ao intervalo de pixels", () => {
    const x = linearScale([0, 1], [10, 210]);
    expect(x(0)).toBe(10);
    expect(x(0.5)).toBe(110);
    expect(x(1)).toBe(210);
  });

  it("aceita intervalo invertido (eixo y do SVG cresce para baixo)", () => {
    const y = linearScale([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(25)).toBe(150);
  });

  it("com domínio vazio, tudo vai para o início do intervalo", () => {
    expect(linearScale([5, 5], [0, 100])(5)).toBe(0);
  });
});

describe("niceTicks", () => {
  it.each([
    [1, 4, [0, 0.5, 1]],
    [100, 4, [0, 50, 100]],
    [78, 4, [0, 20, 40, 60, 80]],
    [3_400_000, 4, [0, 1_000_000, 2_000_000, 3_000_000, 4_000_000]],
  ])("de 0 até cobrir %s", (max, count, expected) => {
    expect(niceTicks(max, count)).toEqual(expected);
  });

  it("não carrega erro de ponto flutuante para o rótulo", () => {
    expect(niceTicks(0.6, 3)).toEqual([0, 0.2, 0.4, 0.6]);
  });

  it("sem valor positivo, só o zero", () => {
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(Number.NaN)).toEqual([0]);
  });
});

describe("sequentialScale", () => {
  it("divide o intervalo em passos iguais, do mais claro ao mais escuro", () => {
    const scale = sequentialScale([0.35, 0.45, 0.6], 5);
    expect(scale?.bands.map((band) => band.step)).toEqual([1, 2, 3, 4, 5]);
    expect(scale?.step(0.35)).toBe(1);
    expect(scale?.step(0.45)).toBe(3);
    expect(scale?.step(0.6)).toBe(5);
  });

  it("o maior valor fecha o último passo", () => {
    const scale = sequentialScale([0, 10], 5);
    expect(scale?.step(10)).toBe(5);
    expect(scale?.bands.at(-1)).toEqual({ step: 5, from: 8, to: 10 });
  });

  it("com todos os valores iguais, usa um passo do meio", () => {
    const scale = sequentialScale([0.5, 0.5], 5);
    expect(scale?.step(0.5)).toBe(3);
    expect(scale?.bands).toEqual([{ step: 3, from: 0.5, to: 0.5 }]);
  });

  it("sem valores, não há escala", () => {
    expect(sequentialScale([], 5)).toBeNull();
  });
});
