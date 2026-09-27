/**
 * Condição do veículo declarada pelo leiloeiro. Vem de texto livre ("MEDIA MONTA / IPVA 2026 PAGO / CIRCULACAO
 * VEDADA / …"); só o que casa com um termo conhecido vira dado. Nada é deduzido: sem termo, fica `null`/vazio.
 * Pesa no valor de revenda, então separa as estimativas (D-28) e os filtros.
 */

/** Classificação de dano, da menos à mais grave. Sucata não volta a circular como veículo. */
export const DAMAGE_LEVELS = ["small", "medium", "large", "salvage"] as const;
export type DamageLevel = (typeof DAMAGE_LEVELS)[number];

export const CONDITION_FLAGS = [
  "circulation_banned",
  "remarked",
  "theft_history",
  "prior_claim",
  "airbag_deployed",
  "missing_parts",
  "recall_pending",
  "cng",
] as const;
export type ConditionFlag = (typeof CONDITION_FLAGS)[number];

/** Resultado do laudo cautelar (vistoria independente). Laudo ausente fica `null`. */
export const INSPECTION_RESULTS = ["approved", "approved_with_notes", "rejected"] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export type ListingCondition = {
  damageLevel: DamageLevel | null;
  flags: ConditionFlag[];
  inspection: InspectionResult | null;
  inspectionNotes: string | null;
};

export const EMPTY_CONDITION: ListingCondition = {
  damageLevel: null,
  flags: [],
  inspection: null,
  inspectionNotes: null,
};

/** Do mais grave para o menos: se o texto citar dois, vale o mais grave. */
const DAMAGE_TERMS: readonly (readonly [DamageLevel, RegExp])[] = [
  ["salvage", /\bSUCATA\b/],
  ["large", /\bGRANDE MONTA\b/],
  ["medium", /\bMEDIA MONTA\b/],
  ["small", /\bPEQUENA MONTA\b/],
];

const FLAG_TERMS: Record<ConditionFlag, RegExp> = {
  circulation_banned: /\bCIRCULACAO VEDADA\b/,
  remarked: /\bREMARCAD[OA]S?\b/,
  theft_history: /\b(ROUBO|FURTO)\b/,
  prior_claim: /\b(POSSUI|RECUPERADO DE|COM) SINISTRO\b/,
  airbag_deployed: /\bAIRBAGS? ACIONADOS?\b/,
  missing_parts: /\bFALTANDO PECAS\b/,
  recall_pending: /\bRECALL PENDENTE\b/,
  cng: /\bGNV\b/,
};

/** Maiúsculas, sem acento, sem HTML e com espaços simples: a forma em que os termos são procurados. */
export function normalizeNotes(text: string): string {
  return plainText(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/** Texto do leiloeiro sem marcação HTML e sem espaços repetidos; vazio vira `null`. */
export function cleanDescription(text: string | null | undefined): string | null {
  if (!text) return null;
  return plainText(text) || null;
}

/** Classificação de dano e marcações citadas na descrição. */
export function parseConditionNotes(text: string | null | undefined): Pick<ListingCondition, "damageLevel" | "flags"> {
  if (!text) return { damageLevel: null, flags: [] };
  const notes = normalizeNotes(text);
  const damageLevel = DAMAGE_TERMS.find(([, pattern]) => pattern.test(notes))?.[0] ?? null;
  const flags = CONDITION_FLAGS.filter((flag) => FLAG_TERMS[flag].test(notes));
  return { damageLevel, flags };
}

/** O mais grave entre dois níveis (ex.: texto diz "pequena monta", mas a categoria é sucata). */
export function worstDamage(a: DamageLevel | null, b: DamageLevel | null): DamageLevel | null {
  if (a === null) return b;
  if (b === null) return a;
  return DAMAGE_LEVELS.indexOf(a) >= DAMAGE_LEVELS.indexOf(b) ? a : b;
}

function plainText(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
