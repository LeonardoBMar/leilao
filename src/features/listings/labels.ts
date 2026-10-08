import type { ConditionFlag, DamageLevel, InspectionResult } from "@/domain/listings/condition";
import type { LimitFit } from "@/domain/listings/estimates";
import type { ListingStatus } from "@/domain/listings/types";

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
