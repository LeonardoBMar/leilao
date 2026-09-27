import { describe, expect, it } from "vitest";

import { cleanDescription, parseConditionNotes, worstDamage } from "./condition";

describe("parseConditionNotes", () => {
  it("lê a classificação de dano no texto do leiloeiro", () => {
    expect(parseConditionNotes("   MEDIA MONTA / IPVA 2026 PAGO / FAZER CSV").damageLevel).toBe("medium");
    expect(parseConditionNotes("PEQUENA MONTA / IPVA 2026 PAGO").damageLevel).toBe("small");
    expect(parseConditionNotes("Grande monta").damageLevel).toBe("large");
    expect(parseConditionNotes("SUCATA / VENDIDO NO ESTADO EM QUE SE ENCONTRA").damageLevel).toBe("salvage");
  });

  it("ignora acento, caixa e HTML", () => {
    expect(parseConditionNotes("<p>Média   monta</p>").damageLevel).toBe("medium");
    expect(parseConditionNotes("circulação vedada").flags).toEqual(["circulation_banned"]);
  });

  it("dois níveis citados: vale o mais grave", () => {
    expect(parseConditionNotes("PEQUENA MONTA / SUCATA").damageLevel).toBe("salvage");
  });

  it("sem termo conhecido não inventa nada", () => {
    expect(parseConditionNotes("IPVA 2026 PAGO / VENDIDO NO ESTADO EM QUE SE ENCONTRA")).toEqual({
      damageLevel: null,
      flags: [],
    });
    expect(parseConditionNotes(null)).toEqual({ damageLevel: null, flags: [] });
    // Palavra que só contém o termo não é classificação.
    expect(parseConditionNotes("MONTADORA ORIGINAL").damageLevel).toBeNull();
  });

  it("marcações que pesam na compra, na ordem fixa", () => {
    const text = [
      "MEDIA MONTA",
      "CIRCULACAO VEDADA",
      "HISTORICO DE ROUBO-FURTO",
      "POSSUI SINISTRO",
      "AIRBAG ACIONADO, QUALQUER TIPO DE REGULARIZACAO POR CONTA DO ARREMATANTE",
      "MOTOR DESMONTADO-FALTANDO PECAS",
      "RECALL PENDENTE",
      "POSSUI GNV",
      "CHASSI REMARCADO",
    ].join(" / ");
    expect(parseConditionNotes(text).flags).toEqual([
      "circulation_banned",
      "remarked",
      "theft_history",
      "prior_claim",
      "airbag_deployed",
      "missing_parts",
      "recall_pending",
      "cng",
    ]);
  });

  it("sinistro só com o termo completo", () => {
    expect(parseConditionNotes("RECUPERADO DE SINISTRO").flags).toEqual(["prior_claim"]);
    expect(parseConditionNotes("SEM SINISTRO").flags).toEqual([]);
  });
});

describe("worstDamage", () => {
  it("fica com o mais grave e aceita ausência", () => {
    expect(worstDamage("small", "salvage")).toBe("salvage");
    expect(worstDamage("medium", "small")).toBe("medium");
    expect(worstDamage(null, "small")).toBe("small");
    expect(worstDamage(null, null)).toBeNull();
  });
});

describe("cleanDescription", () => {
  it("tira HTML e espaços; vazio vira null", () => {
    expect(cleanDescription("<P>\n   IPVA 2026 PAGO  / X</P>")).toBe("IPVA 2026 PAGO / X");
    expect(cleanDescription("  <p> </p> ")).toBeNull();
    expect(cleanDescription(undefined)).toBeNull();
  });
});
