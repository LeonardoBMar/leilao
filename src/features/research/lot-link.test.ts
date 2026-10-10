import { describe, expect, it } from "vitest";

import { DEFAULT_RESEARCH_FILTERS } from "@/domain/research/filters";

import { lotResearchFilters } from "./lot-link";
import { researchHref } from "./search";

const base = { brand: "Chevrolet", model: "Onix Plus", category: null, damageLevel: null, state: null } as const;

describe("lotResearchFilters", () => {
  it("normaliza marca e modelo como a Pesquisa agrupa", () => {
    expect(lotResearchFilters(base).vehicle).toEqual({ brand: "CHEVROLET", model: "ONIX" });
  });

  it("lote sem anúncio ligado fica no padrão da Pesquisa, só com o modelo", () => {
    expect(lotResearchFilters(base)).toEqual({
      ...DEFAULT_RESEARCH_FILTERS,
      vehicle: { brand: "CHEVROLET", model: "ONIX" },
    });
  });

  it.each([
    ["small", "pequena"],
    ["medium", "media"],
    ["large", "grande"],
    ["salvage", "sucata"],
  ] as const)("dano %s vira a condição %s", (damageLevel, condition) => {
    expect(lotResearchFilters({ ...base, damageLevel }).condition).toBe(condition);
  });

  it("usa a categoria e o estado do anúncio ligado", () => {
    const filters = lotResearchFilters({ ...base, brand: "Honda", model: "CG 160", category: "Motos", state: "GO" });
    expect(filters).toMatchObject({ category: "motos", state: "GO" });
  });

  it("categoria fora da Pesquisa (pesados) e estado inválido caem no padrão", () => {
    const filters = lotResearchFilters({ ...base, category: "Pesados", state: "ZZ" });
    expect(filters).toMatchObject({ category: "carros", state: null });
  });

  it("modelo que não se reconhece abre a Pesquisa sem modelo", () => {
    expect(lotResearchFilters({ ...base, brand: "", model: "" }).vehicle).toBeNull();
  });

  it("vira o endereço da Pesquisa com os filtros na URL", () => {
    const href = researchHref(lotResearchFilters({ ...base, damageLevel: "small", state: "SP" }));
    expect(href).toBe("/mercado?condicao=pequena&marca=CHEVROLET&modelo=ONIX&uf=SP");
  });
});
