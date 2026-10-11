import { describe, expect, it } from "vitest";

import { inferOrigin, type VehicleOrigin } from "./origin";

const origin = (sellerName: string | null, recoveryType: string | null = null, sourceId: string | null = "superbid") =>
  inferOrigin({ recoveryType, sellerName, sourceId });

describe("inferOrigin", () => {
  it.each([
    ["Recuperado de Financiamento", "financiamento"],
    ["RECUPERADO FINANCIAMENTO", "financiamento"],
    ["FINACIAMENTO", "financiamento"],
    ["FINANCEIRA", "financiamento"],
    ["Recuperado de Seguradora", "seguradora"],
    ["SINISTRO/PEQUENA MONTA", "seguradora"],
    ["Frota", "frota"],
  ] as const)("o texto de retomada %s manda: %s", (recoveryType, expected) => {
    expect(origin("PREFEITURA MUNICIPAL DE GUARULHOS", recoveryType)).toBe(expected);
  });

  // Os comitentes mais frequentes das vendas em 11/10/2026.
  it.each<[string, VehicleOrigin]>([
    ["PREFEITURA MUNICIPAL DE SÃO BERNARDO DO CAMPO", "orgao_publico"],
    ["POLICIA RODOVIARIA FEDEREAL DE SANTA CATARINA", "orgao_publico"],
    ["DETRAN/MS", "orgao_publico"],
    ["DETRAN/AL", "orgao_publico"],
    ["SPRF PE", "orgao_publico"],
    ["MUNICÍPIO DE MARINGÁ", "orgao_publico"],
    ["PREF MUNICIPAL DE IBIMIRIM/PE", "orgao_publico"],
    ["PALMA SOLA PREF GABINETE DO PREFEITO", "orgao_publico"],
    ["TRIBUNAL DE JUSTIÇA DO ESTADO DA BAHIA", "orgao_publico"],
    ["27º Batalhão de Logistico - Curitiba/PR", "orgao_publico"],
    ["MINISTERIO DA JUSTICA E SEGURANCA PUBLICA (Senad)", "orgao_publico"],
    ["BANCO PAN S/A", "financiamento"],
    ["SANTANDER SOCIEDADE DE CREDITO FINANCIAMENTO E INVESTIMENTO S/A", "financiamento"],
    ["CREDITAS SOLUCOES FINANCEIRAS LTDA", "financiamento"],
    ["ITAPEVA II MULTICARTEIRA", "financiamento"],
    ["OMNI S/A", "financiamento"],
    ["EMBRACON ADMINISTRADORA DE CONSORCIO LTDA", "financiamento"],
    ["COOPERATIVA DE CREDITO, POUPANCA E INVESTIMENTO DO CERRADO DE GOIAS – SICREDI CERRADO GO", "financiamento"],
    ["DEUTSCHE SPARKASSEN LEASING DO BRASIL BANCO MULTIPLO S/A", "financiamento"],
    ["Instituição Financeira", "financiamento"],
    ["ALLIANZ BRASIL SEGURADORA S/A", "seguradora"],
    ["MAPFRE SEGUROS GERAIS S/A - SQG", "seguradora"],
    ["BRASIL VEICULOS CIA DE SEGUROS S/A", "seguradora"],
    ["HDI", "seguradora"],
    ["GM", "frota"],
    ["FORD MOTOR COMPANY BRASIL LTDA", "frota"],
    ["Heineken", "frota"],
    ["TERMOPERNAMBUCO S/A", "frota"],
    ["COMPANHIA DE ELETRICIDADE DO ESTADO DA BAHIA COELBA", "frota"],
    ["COPACOL - COOPERATIVA AGRICOLA CONSOLATA", "frota"],
    ["VERO S.A.", "frota"],
    ["USF - USINA SAO FRANCISCO", "frota"],
    ["VICTOR LEILÕES", "outros"],
    ["GRANDE LEILÃO DE TERCEIROS - MÁQUINAS E VEÍCULOS", "outros"],
    ["P. FÍSICA", "outros"],
    ["LEILOSHOP", "outros"],
    ["Matheus Moyzes", "outros"],
    ["THM", "outros"],
  ])("comitente %s → %s", (sellerName, expected) => {
    expect(origin(sellerName)).toBe(expected);
  });

  it("pátio do Detran é órgão público mesmo sem comitente", () => {
    expect(origin(null, null, "detran-mg")).toBe("orgao_publico");
    expect(origin(null, null, "detran-sc")).toBe("orgao_publico");
  });

  it("sem nenhum sinal, outros", () => {
    expect(origin(null, null, "patio-sao-carlos")).toBe("outros");
    expect(origin("", "-", null)).toBe("outros");
  });
});
