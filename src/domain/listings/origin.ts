import { normalizePlaceName } from "./place";

/**
 * Origem do veículo: de quem ele vem (docs/PLANO-MERCADO.md, T0.3). Puro.
 *
 * O texto de retomada da fonte (`recovery_type`) cobria só 21% das vendas em 11/10/2026: a Superbid, 61% da base,
 * não o informa. O comitente (`seller_name`), presente em 92%, diz o mesmo: banco, seguradora, prefeitura ou Detran,
 * empresa. A ordem importa: o texto de retomada vem primeiro; no comitente, banco e seguradora antes de empresa
 * ("BANCO PAN S/A" é banco, não frota); leiloeiro e pessoa física não dizem a origem. Sem sinal claro, "outros"
 * (nunca adivinhado).
 */
export const VEHICLE_ORIGINS = ["financiamento", "seguradora", "frota", "orgao_publico", "outros"] as const;
export type VehicleOrigin = (typeof VEHICLE_ORIGINS)[number];

export type OriginInput = { recoveryType: string | null; sellerName: string | null; sourceId: string | null };

/** Fontes que só vendem veículos de um órgão público (pátio do Detran). */
const PUBLIC_SOURCES: ReadonlySet<string> = new Set(["detran-mg", "detran-sc"]);

const SELLER_RULES: readonly [RegExp, VehicleOrigin][] = [
  [/\bSEGUR(?:O|OS|ADORA)\b|ALLIANZ|MAPFRE|ZURICH|\bHDI\b|TOKIO MARINE|LIBERTY|SUHAI|YOUSE/, "seguradora"],
  [
    /\bBANCO\b|FINANC|CREDITO|CREDITAS|CONSORCIO|LEASING|\bOMNI\b|SICREDI|SICOOB|MULTICARTEIRA|ITAUCARD|AYMORE|COBRANCA/,
    "financiamento",
  ],
  [
    /PREFEITURA|\bPREF\b|MUNICIPIO|MUNICIPAL|DETRAN|POLICIA|\bS?PRF\b|RODOVIARIA FEDERAL|TRIBUNAL|MINISTERIO|BATALHAO|EXERCITO|SECRETARIA|GOVERNO|RECEITA FEDERAL/,
    "orgao_publico",
  ],
  [/LEILO|LEILAO|P\.? FISICA|PESSOA FISICA|^OUTROS$/, "outros"],
  [
    /\bS ?\/ ?A\b|\bS\.? ?A\.?$|\bLTDA\b|\bCIA\b|COMPANHIA|COOPERATIVA|USINA|DISTRIBUIDORA|LOCADORA|LOCACAO|LOGISTICA|TRANSPORTE|INDUSTRIA|COMERCIO|ENERGIA|ELETRICIDADE|ENERGETICA|CONCESSIONARIA|PARTICIPACOES|ENGENHARIA|MINING|AGRICOLA|AGROPECUARIA|ALIMENTOS|SHIPPING|MOTOR|\bGM\b|HEINEKEN|JADLOG|PETROBRAS|CPFL|COMGAS|COLGATE|BUNGE|FEDEX/,
    "frota",
  ],
];

export function inferOrigin({ recoveryType, sellerName, sourceId }: OriginInput): VehicleOrigin {
  const recovery = normalizePlaceName(recoveryType ?? "");
  if (/FINAN|FINAC/.test(recovery)) return "financiamento";
  if (/SEGUR|SINISTRO/.test(recovery)) return "seguradora";
  if (/\bFROTA\b/.test(recovery)) return "frota";

  const seller = normalizePlaceName(sellerName ?? "");
  if (seller !== "") {
    const rule = SELLER_RULES.find(([pattern]) => pattern.test(seller));
    if (rule !== undefined) return rule[1];
  }

  return sourceId !== null && PUBLIC_SOURCES.has(sourceId) ? "orgao_publico" : "outros";
}
