/**
 * Checklist de diligência pré-lance (D-97): 7 verificações padronizadas antes de fixar o lance máximo.
 * Puro, sem dependência de banco ou UI.
 */

export const DILIGENCE_ITEMS = [
  {
    key: "notice_read",
    label: "Edital lido (débitos e prazos conferidos)",
    critical: true,
  },
  {
    key: "restrictions_checked",
    label: "Restrições, bloqueios e histórico checados",
    critical: true,
  },
  {
    key: "condition_assessed",
    label: "Condição, monta e risco de enchente avaliados",
    critical: true,
  },
  {
    key: "inspection_done",
    label: "Fotos inspecionadas ou vistoria presencial feita",
    critical: false,
  },
  {
    key: "repair_quoted",
    label: "Cotação realista de peças e funilaria",
    critical: false,
  },
  {
    key: "liquidity_checked",
    label: "Liquidez e aceitação de seguro/financiamento consideradas",
    critical: false,
  },
  {
    key: "capital_ready",
    label: "Capital disponível dentro do prazo de pagamento",
    critical: true,
  },
] as const;

export type DiligenceItemDef = (typeof DILIGENCE_ITEMS)[number];
export type DiligenceKey = DiligenceItemDef["key"];

export const DILIGENCE_KEYS = [
  "notice_read",
  "restrictions_checked",
  "condition_assessed",
  "inspection_done",
  "repair_quoted",
  "liquidity_checked",
  "capital_ready",
] as const satisfies readonly DiligenceKey[];

export type DiligenceChecklist = {
  items: Record<DiligenceKey, boolean>;
  updatedAt: string | null;
};

export type DiligenceSummary = {
  completed: number;
  total: number;
  criticalPending: DiligenceItemDef[];
  isComplete: boolean;
};

export type PlateLookupLink = {
  id: "senatran_recall" | "senatran_portal";
  label: string;
  description: string;
  href: string;
};

export function emptyDiligenceChecklist(): DiligenceChecklist {
  return {
    items: {
      notice_read: false,
      restrictions_checked: false,
      condition_assessed: false,
      inspection_done: false,
      repair_quoted: false,
      liquidity_checked: false,
      capital_ready: false,
    },
    updatedAt: null,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Lê com segurança um JSONB armazenado em `lots.diligence_checklist`. */
export function parseDiligenceChecklist(raw: unknown): DiligenceChecklist {
  const base = emptyDiligenceChecklist();
  if (!isPlainObject(raw)) return base;
  const rawItems = isPlainObject(raw.items) ? raw.items : null;
  if (rawItems) {
    for (const def of DILIGENCE_ITEMS) {
      if (rawItems[def.key] === true) base.items[def.key] = true;
    }
  }
  if (typeof raw.updatedAt === "string") base.updatedAt = raw.updatedAt;
  return base;
}

/** Resume o progresso da diligência e lista itens críticos ainda pendentes. */
export function summarizeDiligence(checklist: DiligenceChecklist): DiligenceSummary {
  let completed = 0;
  const criticalPending: DiligenceItemDef[] = [];

  for (const def of DILIGENCE_ITEMS) {
    if (checklist.items[def.key]) {
      completed += 1;
    } else if (def.critical) {
      criticalPending.push(def);
    }
  }

  return {
    completed,
    total: DILIGENCE_ITEMS.length,
    criticalPending,
    isComplete: completed === DILIGENCE_ITEMS.length,
  };
}

const VALID_PLATE_RE = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

/** Normaliza placa brasileira (antiga ou Mercosul) e devolve atalhos públicos de verificação (sem scraping). */
export function plateLookupLinks(plate: string | null | undefined): PlateLookupLink[] {
  if (!plate) return [];
  const normalized = plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!VALID_PLATE_RE.test(normalized)) return [];

  return [
    {
      id: "senatran_recall",
      label: `Recall Senatran (${normalized})`,
      description: "Portal oficial de consulta de recalls pendentes por placa ou chassi.",
      href: "https://portalservicos.senatran.serpro.gov.br/#/veiculos/recall",
    },
    {
      id: "senatran_portal",
      label: "Portal Senatran (infrações e restrições)",
      description: "Consulta oficial de débitos, restrições e histórico no Portal de Serviços Senatran.",
      href: "https://portalservicos.senatran.serpro.gov.br/",
    },
  ];
}
