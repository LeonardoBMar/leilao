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
