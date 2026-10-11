import type { ConditionFlag, DamageLevel, InspectionResult } from "@/domain/listings/condition";
import type { ComparableLevel, EstimateConfidence, LimitFit, PriceEstimate } from "@/domain/listings/estimates";
import type { MarketValueOrigin } from "@/domain/listings/fipe-match";
import type { ListingStatus } from "@/domain/listings/types";
import { formatShortMonth } from "@/lib/format";

export const LISTING_STATUS_LABELS = {
  open: "Aberto",
  sold: "Vendido",
  conditional: "Condicional",
  unsold: "Sem arrematação",
  withdrawn: "Retirado",
  unknown: "Desfecho desconhecido",
} satisfies Record<ListingStatus, string>;

export const LISTING_STATUS_VARIANTS = {
  open: "primary",
  sold: "success",
  conditional: "warning",
  unsold: "default",
  withdrawn: "default",
  unknown: "outline",
} as const satisfies Record<ListingStatus, "primary" | "success" | "warning" | "default" | "outline">;

export const DAMAGE_LABELS = {
  small: "Pequena monta",
  medium: "Média monta",
  large: "Grande monta",
  salvage: "Sucata",
} satisfies Record<DamageLevel, string>;

export const DAMAGE_VARIANTS = {
  small: "warning",
  medium: "warning",
  large: "destructive",
  salvage: "destructive",
} as const satisfies Record<DamageLevel, "warning" | "destructive">;

export const CONDITION_FLAG_LABELS = {
  circulation_banned: "Circulação vedada",
  remarked: "Remarcado",
  theft_history: "Histórico de roubo/furto",
  prior_claim: "Sinistro",
  airbag_deployed: "Airbag acionado",
  missing_parts: "Faltando peças",
  recall_pending: "Recall pendente",
  cng: "GNV",
} satisfies Record<ConditionFlag, string>;

export const INSPECTION_LABELS = {
  approved: "Laudo aprovado",
  approved_with_notes: "Laudo com observações",
  rejected: "Laudo reprovado",
} satisfies Record<InspectionResult, string>;

export const INSPECTION_VARIANTS = {
  approved: "success",
  approved_with_notes: "warning",
  rejected: "destructive",
} as const satisfies Record<InspectionResult, "success" | "warning" | "destructive">;

/** Provável frente ao limite (D-44). O texto sempre diz a situação; a cor só reforça. */
export const LIMIT_FIT_LABELS = {
  comfortable: "Cabe com folga",
  tight: "No limite",
  above: "Provável acima do limite",
} satisfies Record<LimitFit, string>;

export const LIMIT_FIT_VARIANTS = {
  comfortable: "success",
  tight: "warning",
  above: "destructive",
} as const satisfies Record<LimitFit, "success" | "warning" | "destructive">;

/** Confiança do preço provável (D-72): pelo número de vendas e pela largura da faixa. */
export const CONFIDENCE_LABELS = {
  high: "confiança alta",
  medium: "confiança média",
  low: "confiança baixa",
} satisfies Record<EstimateConfidence, string>;

/** De que grupo vieram os comparáveis (D-72). */
export const COMPARABLE_LEVEL_LABELS = {
  version: "da mesma versão",
  family: "da mesma família",
  model: "do mesmo modelo",
} satisfies Record<ComparableLevel, string>;

/**
 * De onde veio o preço provável, curto, para ao lado do valor: "12 vendas, confiança alta" ou "pela categoria,
 * confiança baixa". Sem base, `null` (quem chama diz o que falta).
 */
export function priceEvidenceLabel(price: PriceEstimate): string | null {
  if (price.kind === "insufficient") return null;
  const basis = price.kind === "comparables" ? `${price.n} ${price.n === 1 ? "venda" : "vendas"}` : "pela categoria";
  return `${basis}, ${CONFIDENCE_LABELS[price.confidence]}`;
}

/** O mesmo, por extenso, para "Como foi estimado". */
export function priceBasisLabel(price: PriceEstimate): string | null {
  if (price.kind === "insufficient") return null;
  if (price.kind === "market_ratio") {
    return `proporção do valor de mercado em ${price.n} vendas da mesma categoria e condição`;
  }
  const origin = price.sameOrigin ? " e da mesma origem" : "";
  return `${price.n} vendas ${COMPARABLE_LEVEL_LABELS[price.level]}${origin}, ano ±1 e mesma condição`;
}

/**
 * De onde veio o valor de mercado (D-47): o da fonte ou o casado pelo sistema na tabela FIPE do mês, com aviso quando
 * a versão é aproximada (mediana das versões parecidas).
 */
export function marketValueOriginLabel(origin: MarketValueOrigin | null, refMonth: Date | null): string | null {
  if (origin === null) return null;
  if (origin === "source") return "da fonte";
  const month = refMonth === null ? "" : ` ${formatShortMonth(refMonth)}`;
  return origin === "fipe_version" ? `FIPE${month}` : `FIPE${month} · versão aproximada`;
}
