import { describe, expect, it } from "vitest";

import { bps, cents } from "@/domain/money";

import { auditNoticeText } from "./notice-audit";

describe("auditNoticeText", () => {
  it("retorna resultado vazio para texto em branco", () => {
    const result = auditNoticeText("   \n\t  ");
    expect(result.findings).toEqual([]);
    expect(result.textLength).toBe(0);
    expect(result.counts).toEqual({ critical: 0, warning: 0, info: 0 });
  });

  it("extrai taxas, prazos, débitos e alertas críticos de um edital realista com trechos literais", () => {
    const notice = `
      EDITAL DE LEILÃO DE VEÍCULOS — SUPERBID / FREITAS
      1. O arrematante pagará comissão do leiloeiro de 5% sobre o valor da arrematação, além de taxa administrativa
      de R$ 1.850,00 por lote.
      2. Todos os débitos de IPVA, multas e licenciamento correrão por conta do arrematante.
      3. O pagamento deverá ser efetuado em até 24 horas após o encerramento do pregão.
      4. Prazo de retirada do veículo: 5 dias úteis. Após o prazo incidirá diária de estadia de R$ 120,00.
      5. Documentação e emissão do ATPV-e em até 60 dias úteis.
      6. Observações do lote: veículo recuperado de enchente, média monta com necessidade de CSV, sem chave,
      chassi remarcado e motor e câmbio não testados.
    `;

    const result = auditNoticeText(notice);

    expect(result.extractedFees.commissionRateBps).toBe(bps(500));
    expect(result.extractedFees.adminFeesCents).toBe(cents(185_000));
    expect(result.extractedFees.dailyStorageCents).toBe(cents(12_000));
    expect(result.extractedFees.paymentDeadlineHours).toBe(24);
    expect(result.extractedFees.documentDeadlineDays).toBe(60);

    const ids = result.findings.map((finding) => finding.id);
    expect(ids).toContain("debts_buyer");
    expect(ids).toContain("commission_rate");
    expect(ids).toContain("admin_fee");
    expect(ids).toContain("daily_storage");
    expect(ids).toContain("payment_deadline");
    expect(ids).toContain("document_deadline");
    expect(ids).toContain("pickup_deadline");
    expect(ids).toContain("cond_flood");
    expect(ids).toContain("cond_chassis");
    expect(ids).toContain("cond_medium_damage");
    expect(ids).toContain("cond_no_key");
    expect(ids).toContain("cond_untested");

    // Ordenação: critical antes de warning e info
    expect(result.findings[0]?.severity).toBe("critical");
    expect(result.counts.critical).toBe(3); // debts_buyer, cond_flood, cond_chassis
    // Trecho literal preserva acentuação original
    const flood = result.findings.find((finding) => finding.id === "cond_flood");
    expect(flood?.excerpt).toContain("enchente");
    const debts = result.findings.find((finding) => finding.id === "debts_buyer");
    expect(debts?.excerpt).toContain("débitos de IPVA");
  });

  it("identifica teto de débitos, sucata, bloqueio Renajud e débitos quitados pelo Detran", () => {
    const capped = auditNoticeText(
      "Eventuais débitos de IPVA até o limite de R$ 500,00 serão de responsabilidade do arrematante. Lote com bloqueio judicial Renajud e grande monta.",
    );
    expect(capped.extractedFees.debtsCapCents).toBe(cents(50_000));
    expect(capped.findings.some((item) => item.id === "debts_capped")).toBe(true);
    expect(capped.findings.some((item) => item.id === "debts_buyer")).toBe(false);
    expect(capped.findings.some((item) => item.id === "cond_judicial")).toBe(true);
    expect(capped.findings.some((item) => item.id === "cond_large_damage")).toBe(true);

    const detran = auditNoticeText(
      "Veículo vendido como sucata, circulação vedada. Débitos anteriores desvinculados pelo Detran.",
    );
    expect(detran.findings.some((item) => item.id === "cond_salvage")).toBe(true);
    expect(detran.findings.some((item) => item.id === "debts_seller")).toBe(true);
  });

  it("lida com vírgula após valor, tabela escalonada, abreviações com ponto e marcas combinantes órfãs", () => {
    const punctuated = auditNoticeText(
      "A taxa administrativa de R$ 1.850,00, além da comissão de 5%, será cobrada. Débitos de IPVA (cf. art. 12) correrão por conta do arrematante.",
    );
    expect(punctuated.extractedFees.adminFeesCents).toBe(cents(185_000));
    expect(punctuated.findings.some((item) => item.id === "admin_fee")).toBe(true);
    expect(punctuated.findings.some((item) => item.id === "debts_buyer")).toBe(true);

    const tiered = auditNoticeText(
      "Taxa administrativa: para lotes até R$ 19.999,99: R$ 850,00; acima disso consultar tabela.",
    );
    expect(tiered.extractedFees.adminFeesCents).toBe(cents(85_000));

    // Marca combinante órfã e caractere `İ` antes do termo não deslocam o trecho literal citado.
    const unicodeText =
      "İ\u0301\u0302 Aviso prévio de leitura obrigatória: veículo com histórico de enchente no pátio.";
    const unicodeAudit = auditNoticeText(unicodeText);
    const flood = unicodeAudit.findings.find((item) => item.id === "cond_flood");
    expect(flood?.excerpt).toContain("enchente");
  });
});
