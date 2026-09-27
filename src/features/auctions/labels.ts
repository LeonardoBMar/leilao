import { AUCTION_ORIGINS, AUCTION_STATUSES, type AuctionOrigin, type AuctionStatus } from "./schemas";

/** Textos de interface das classificações de leilão (SPEC RF-01). */
export const ORIGIN_LABELS = {
  detran: "Detran",
  insurer: "Seguradora",
  financial: "Financeira",
  judicial: "Judicial",
  other: "Outros",
  unknown: "Não informada",
} satisfies Record<AuctionOrigin, string>;

export const STATUS_LABELS = {
  scheduled: "Agendado",
  in_progress: "Em andamento",
  finished: "Encerrado",
  cancelled: "Cancelado",
} satisfies Record<AuctionStatus, string>;

export const STATUS_BADGE_VARIANTS = {
  scheduled: "primary",
  in_progress: "warning",
  finished: "default",
  cancelled: "outline",
} as const satisfies Record<AuctionStatus, "primary" | "warning" | "default" | "outline">;

export const ORIGIN_OPTIONS = AUCTION_ORIGINS.map((value) => ({ value, label: ORIGIN_LABELS[value] }));
export const STATUS_OPTIONS = AUCTION_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));
