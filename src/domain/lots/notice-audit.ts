import { type Bps, bps, type Cents, parseBRL } from "@/domain/money";

/**
 * Auditoria determinística de edital (D-97): identifica cláusulas críticas de débitos, taxas extras,
 * prazos e alertas de condição em editais brasileiros de leilão de veículos (Detran, Superbid, Freitas,
 * Copart, Sodré, Leilo), sempre citando o trecho literal encontrado no texto.
 */

export type NoticeFindingSeverity = "critical" | "warning" | "info";
export type NoticeFindingCategory = "debts" | "fees" | "deadlines" | "condition";

export type NoticeFinding = {
  id: string;
  category: NoticeFindingCategory;
  severity: NoticeFindingSeverity;
  title: string;
  summary: string;
  excerpt: string;
};

export type ExtractedNoticeFees = {
  commissionRateBps: Bps | null;
  adminFeesCents: Cents | null;
  debtsCapCents: Cents | null;
  dailyStorageCents: Cents | null;
  paymentDeadlineHours: number | null;
  documentDeadlineDays: number | null;
};

export type NoticeAuditResult = {
  findings: NoticeFinding[];
  extractedFees: ExtractedNoticeFees;
  counts: { critical: number; warning: number; info: number };
  textLength: number;
};

const SEVERITY_ORDER: Record<NoticeFindingSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const MAX_EXCERPT_HALF = 95;
/** Captura valor monetário em reais sem incluir vírgula/ponto de pontuação seguinte. */
const MONEY_CAPTURE = "r\\$\\s*(\\d+(?:\\.\\d{3})*(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";

type PreparedText = {
  clean: string;
  folded: string;
  /** Mapeia cada índice de `folded` para o índice correspondente em `clean` (evita drift com Unicode). */
  cleanIndexAt: number[];
};

function prepareText(rawText: string): PreparedText {
  const clean = rawText.normalize("NFC").replace(/\s+/g, " ").trim();
  const foldedChars: string[] = [];
  const cleanIndexAt: number[] = [];

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i] ?? "";
    const normalized = ch
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    for (let j = 0; j < normalized.length; j += 1) {
      foldedChars.push(normalized[j] ?? "");
      cleanIndexAt.push(i);
    }
  }

  return { clean, folded: foldedChars.join(""), cleanIndexAt };
}

function buildExcerpt(prepared: PreparedText, foldedStart: number, foldedLength: number): string {
  const { clean, cleanIndexAt } = prepared;
  const cleanStart = cleanIndexAt[foldedStart] ?? 0;
  const foldedEnd = Math.min(cleanIndexAt.length - 1, foldedStart + Math.max(0, foldedLength - 1));
  const cleanEnd = (cleanIndexAt[foldedEnd] ?? clean.length - 1) + 1;

  const start = Math.max(0, cleanStart - MAX_EXCERPT_HALF);
  const end = Math.min(clean.length, cleanEnd + MAX_EXCERPT_HALF);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";
  return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}

function parsePercentToBps(raw: string): Bps | null {
  const numeric = Number(raw.replace(",", "."));
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 30) return null;
  return bps(Math.round(numeric * 100));
}

function parseMoneyValue(raw: string): Cents | null {
  const trimmed = raw.replace(/[.,;:]+$/, "");
  const value = parseBRL(trimmed);
  if (value === null || value <= 0 || value > 50_000_000) return null;
  return value;
}

/**
 * Executa a auditoria determinística sobre o texto de um edital.
 * Pura, síncrona e livre de dependências externas.
 */
export function auditNoticeText(rawText: string): NoticeAuditResult {
  const prepared = prepareText(rawText);
  const { clean, folded } = prepared;
  const extractedFees: ExtractedNoticeFees = {
    commissionRateBps: null,
    adminFeesCents: null,
    debtsCapCents: null,
    dailyStorageCents: null,
    paymentDeadlineHours: null,
    documentDeadlineDays: null,
  };

  if (clean.length === 0) {
    return {
      findings: [],
      extractedFees,
      counts: { critical: 0, warning: 0, info: 0 },
      textLength: 0,
    };
  }

  const findings = new Map<string, NoticeFinding>();
  const addFinding = (
    id: string,
    category: NoticeFindingCategory,
    severity: NoticeFindingSeverity,
    title: string,
    summary: string,
    match: RegExpExecArray,
  ) => {
    if (findings.has(id)) return;
    findings.set(id, {
      id,
      category,
      severity,
      title,
      summary,
      excerpt: buildExcerpt(prepared, match.index, match[0].length),
    });
  };

  // --- 1. DÉBITOS (IPVA, MULTAS, LICENCIAMENTO) ---
  const debtsCapRe = new RegExp(
    `(?:debitos?|ipva|multas?|licenciamento)[^;\\n]{0,140}?(?:ate\\s+(?:o\\s+limite\\s+de\\s+)?|limitad[oa]s?\\s+a\\s+)${MONEY_CAPTURE}`,
    "i",
  );
  const debtsCapMatch = debtsCapRe.exec(folded);
  if (debtsCapMatch) {
    const cap = parseMoneyValue(debtsCapMatch[1] ?? "");
    if (cap !== null) extractedFees.debtsCapCents = cap;
    addFinding(
      "debts_capped",
      "debts",
      "warning",
      "Débitos com teto para o arrematante",
      cap !== null
        ? `O edital atribui débitos ao arrematante até o teto identificado de R$ ${(cap / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`
        : "O edital estabelece teto de responsabilidade por débitos para o arrematante.",
      debtsCapMatch,
    );
  }

  const debtsBuyerMatch =
    /(?:debitos?|ipva|multas?|licenciamento|dpvat)[^;\n]{0,140}?(?:por\s+conta\s+do\s+arrematante|responsabilidade\s+(?:exclusiva\s+)?do\s+arrematante|correr(?:ao|a)\s+por\s+conta\s+do\s+(?:arrematante|comprador)|a\s+cargo\s+do\s+arrematante)/i.exec(
      folded,
    );
  if (debtsBuyerMatch && !debtsCapMatch) {
    addFinding(
      "debts_buyer",
      "debts",
      "critical",
      "Débitos por conta do arrematante",
      "IPVA, multas ou licenciamento ficam a cargo do arrematante. Consulte o valor exato antes de fixar o lance.",
      debtsBuyerMatch,
    );
  }

  const debtsSellerMatch =
    /(?:debitos?|ipva|multas?)[^;\n]{0,120}?(?:quitados?\s+pelo\s+(?:comitente|vendedor|detran)|desvinculad[oa]s?|livres?\s+de\s+(?:quaisquer\s+)?(?:onus|debitos)|isent[oa]s?\s+de\s+debitos)/i.exec(
      folded,
    );
  if (debtsSellerMatch && !debtsBuyerMatch) {
    addFinding(
      "debts_seller",
      "debts",
      "info",
      "Débitos quitados ou desvinculados pelo comitente",
      "O edital indica quitação ou desvinculação de débitos anteriores pelo comitente/órgão.",
      debtsSellerMatch,
    );
  }

  // --- 2. TAXAS EXTRAS ---
  const commissionMatch =
    /comissao[^;\n]{0,60}?(\d{1,2}(?:[.,]\d{1,2})?)\s*%|(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:\([^)]+\)\s*)?(?:a\s+titulo\s+de\s+|de\s+)?comissao/i.exec(
      folded,
    );
  if (commissionMatch) {
    const rate = parsePercentToBps(commissionMatch[1] ?? commissionMatch[2] ?? "");
    if (rate !== null) {
      extractedFees.commissionRateBps = rate;
      addFinding(
        "commission_rate",
        "fees",
        "info",
        `Comissão do leiloeiro: ${(rate / 100).toLocaleString("pt-BR")}%`,
        "Percentual de comissão sobre o lance arrematado identificado no edital.",
        commissionMatch,
      );
    }
  }

  // Em tabelas escalonadas ("para lotes até R$ 19.999,99: R$ 850,00"), prioriza o valor após ":" ou o não precedido por "ate".
  const adminTieredRe = new RegExp(
    `(?:taxa\\s+(?:administrativa|de\\s+logistica|de\\s+patio|de\\s+remocao|de\\s+entrega|operacional)|despesas?\\s+(?:administrativas?|operacionais?|de\\s+organizacao|de\\s+patio|de\\s+logistica))[^;\\n]{0,90}?(?:ate|de)\\s+${MONEY_CAPTURE}\\s*(?:a\\s+r\\$\\s*[\\d.,]+)?\\s*[:\\-–]\\s*${MONEY_CAPTURE}`,
    "i",
  );
  const adminSimpleRe = new RegExp(
    `(?:taxa\\s+(?:administrativa|de\\s+logistica|de\\s+patio|de\\s+remocao|de\\s+entrega|operacional)|despesas?\\s+(?:administrativas?|operacionais?|de\\s+organizacao|de\\s+patio|de\\s+logistica))[^;\\n]{0,100}?${MONEY_CAPTURE}`,
    "i",
  );
  const adminTieredMatch = adminTieredRe.exec(folded);
  const adminFeeMatch = adminTieredMatch ?? adminSimpleRe.exec(folded);
  if (adminFeeMatch) {
    const captured = adminTieredMatch ? (adminTieredMatch[2] ?? "") : (adminFeeMatch[1] ?? "");
    const fee = parseMoneyValue(captured);
    if (fee !== null) {
      extractedFees.adminFeesCents = fee;
      addFinding(
        "admin_fee",
        "fees",
        "warning",
        `Taxa administrativa / logística: R$ ${(fee / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        adminTieredMatch
          ? "Tabela escalonada de taxa administrativa detectada — confira a faixa correspondente ao seu lance."
          : "Taxa fixa adicional cobrada além da comissão do leiloeiro.",
        adminFeeMatch,
      );
    }
  }

  const storageRe = new RegExp(
    `(?:estadia|diaria|permanencia\\s+no\\s+patio|guarda)[^;\\n]{0,90}?${MONEY_CAPTURE}`,
    "i",
  );
  const storageMatch = storageRe.exec(folded);
  if (storageMatch) {
    const daily = parseMoneyValue(storageMatch[1] ?? "");
    if (daily !== null) extractedFees.dailyStorageCents = daily;
    addFinding(
      "daily_storage",
      "fees",
      "warning",
      daily !== null
        ? `Diária de estadia em pátio: R$ ${(daily / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        : "Cobrança de estadia em pátio após o prazo",
      "Atraso na retirada gera cobrança diária de permanência no pátio.",
      storageMatch,
    );
  }

  // --- 3. PRAZOS CRÍTICOS ---
  const paymentHoursMatch =
    /(?:pagamento|quitacao)[^;\n]{0,100}?(?:prazo\s+(?:maximo\s+)?de\s+|em\s+ate\s+|ate\s+)(\d{1,3})\s*(horas?|h\b|dias?\s+uteis?|dias?)/i.exec(
      folded,
    );
  if (paymentHoursMatch) {
    const qty = Number(paymentHoursMatch[1]);
    const unit = paymentHoursMatch[2] ?? "";
    if (Number.isFinite(qty) && qty > 0 && qty <= 365) {
      const hours = unit.startsWith("h") ? qty : qty * 24;
      extractedFees.paymentDeadlineHours = hours;
      addFinding(
        "payment_deadline",
        "deadlines",
        hours <= 48 ? "warning" : "info",
        `Prazo de pagamento: ${qty} ${unit.trim()}`,
        hours <= 48
          ? "Prazo curto de quitação — garanta liquidez imediata antes de dar o lance."
          : "Prazo de pagamento identificado no edital.",
        paymentHoursMatch,
      );
    }
  }

  const docDaysMatch =
    /(?:documentacao|documento|atpv-?e|crv|crlv|transferencia|emissao\s+do\s+documento)[^;\n]{0,110}?(?:ate\s+|prazo\s+(?:de\s+|estimado\s+de\s+)?)(\d{1,3})\s*(dias?\s+uteis?|dias?)/i.exec(
      folded,
    );
  if (docDaysMatch) {
    const days = Number(docDaysMatch[1]);
    const unit = docDaysMatch[2] ?? "dias";
    if (Number.isFinite(days) && days > 0 && days <= 365) {
      extractedFees.documentDeadlineDays = days;
      addFinding(
        "document_deadline",
        "deadlines",
        days >= 45 ? "warning" : "info",
        `Prazo de documentação / ATPV-e: ${days} ${unit.trim()}`,
        days >= 45
          ? "Prazo longo de entrega de documento — impacta diretamente o tempo de capital parado (giro)."
          : "Prazo estimado para disponibilização da documentação.",
        docDaysMatch,
      );
    }
  }

  const pickupMatch =
    /(?:retirada\s+do\s+(?:veiculo|bem|lote)|prazo\s+de\s+retirada)[^;\n]{0,90}?(\d{1,3})\s*(dias?\s+uteis?|dias?)/i.exec(
      folded,
    );
  if (pickupMatch) {
    addFinding(
      "pickup_deadline",
      "deadlines",
      "info",
      `Prazo de retirada: ${pickupMatch[1]} ${(pickupMatch[2] ?? "dias").trim()}`,
      "Confira agendamento e necessidade de guincho dentro do prazo para evitar diárias.",
      pickupMatch,
    );
  }

  // --- 4. ALERTAS DE CONDIÇÃO ---
  const conditionRules: Array<{
    id: string;
    severity: NoticeFindingSeverity;
    title: string;
    summary: string;
    pattern: RegExp;
  }> = [
    {
      id: "cond_flood",
      severity: "critical",
      title: "Indício de enchente / alagamento",
      summary: "Veículo com histórico de água/enchente tem alto risco elétrico, estrutural e desvalorização forte.",
      pattern: /\b(?:enchente|alagamento|alagado|submerso|inundacao)\b/i,
    },
    {
      id: "cond_salvage",
      severity: "critical",
      title: "Sucata / circulação vedada",
      summary: "Veículo classificado como sucata ou sem direito a documentação — não pode voltar a circular.",
      pattern: /\b(?:sucata|circulacao\s+vedada|baixa\s+definitiva|sem\s+direito\s+a\s+documentacao)\b/i,
    },
    {
      id: "cond_chassis",
      severity: "critical",
      title: "Chassi ou motor remarcado / divergente",
      summary: "Exige regularização, laudo e reduz drasticamente a liquidez e aceitação em seguradoras.",
      pattern:
        /\b(?:chassi\s+remarcado|remarcacao\s+de\s+chassi|motor\s+remarcado|numeracao\s+(?:do\s+)?(?:chassi|motor)\s+(?:suprimida|divergente|ilegivel|oxidada))\b/i,
    },
    {
      id: "cond_judicial",
      severity: "critical",
      title: "Bloqueio judicial / Renajud",
      summary: "Restrição judicial pode atrasar meses a transferência ou impedir licenciamento.",
      pattern: /\b(?:renajud|bloqueio\s+judicial|restricao\s+judicial|penhora\s+judicial)\b/i,
    },
    {
      id: "cond_large_damage",
      severity: "critical",
      title: "Sinistro de grande monta",
      summary: "Grande monta exige atenção redobrada quanto à viabilidade de regularização e revenda.",
      pattern: /\b(?:grande\s+monta)\b/i,
    },
    {
      id: "cond_medium_damage",
      severity: "warning",
      title: "Sinistro de média monta / CSV",
      summary: "Exige laudo CSV/Inmetro para desbloqueio e costuma constar sinistro no documento.",
      pattern:
        /\b(?:media\s+monta|certificado\s+de\s+seguranca\s+veicular|\bcsv\b|sinistrado|recuperado\s+de\s+sinistro)\b/i,
    },
    {
      id: "cond_no_key",
      severity: "warning",
      title: "Veículo sem chave",
      summary: "Previna custo de chaveiro/codificação e impossibilidade de testar ignição no pátio.",
      pattern: /\b(?:sem\s+chave|ausencia\s+de\s+chave|nao\s+possui\s+chave)\b/i,
    },
    {
      id: "cond_untested",
      severity: "info",
      title: "Motor/câmbio não testados ou vendido no estado",
      summary: "Sem garantia de funcionamento mecânico; mantenha reserva de risco adequada.",
      pattern:
        /\b(?:motor\s+(?:e\s+cambio\s+)?nao\s+testad[oa]s?|no\s+estado\s+em\s+que\s+se\s+encontra|sem\s+garantia\s+de\s+funcionamento)\b/i,
    },
  ];

  for (const rule of conditionRules) {
    const match = rule.pattern.exec(folded);
    if (match) addFinding(rule.id, "condition", rule.severity, rule.title, rule.summary, match);
  }

  const sorted = [...findings.values()].toSorted((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const counts = {
    critical: sorted.filter((item) => item.severity === "critical").length,
    warning: sorted.filter((item) => item.severity === "warning").length,
    info: sorted.filter((item) => item.severity === "info").length,
  };

  return {
    findings: sorted,
    extractedFees,
    counts,
    textLength: clean.length,
  };
}
