import type { FipeVehicleType } from "@/domain/listings/fipe-match";
import type { CollectorHealth } from "@/domain/listings/health";

export const SOURCE_HEALTH_LABELS: Record<CollectorHealth, string> = {
  never: "Sem coletas",
  running: "Em andamento",
  ok: "Saudável",
  late: "Atrasada",
  failed: "Falhou",
};

export const SOURCE_HEALTH_VARIANTS: Record<
  CollectorHealth,
  "outline" | "default" | "success" | "warning" | "destructive"
> = {
  never: "outline",
  running: "default",
  ok: "success",
  late: "warning",
  failed: "destructive",
};

export const FIPE_REASON_LABELS: Record<string, string> = {
  no_brand: "Marca não reconhecida na FIPE",
  no_model: "Modelo ausente no anúncio",
  no_candidates: "Modelo sem casamento na FIPE",
  too_many: "Muitas versões candidatas",
  spread: "Versões com preços muito distantes",
  no_value: "Sem preço na tabela FIPE do mês",
  out_of_fipe: "Fora da tabela FIPE (implemento/máquina/sem FIPE)",
  year_out_of_range: "Ano-modelo fora da tabela FIPE",
  manual: "Marcado manualmente sem FIPE",
};

export const FIPE_VEHICLE_TYPE_LABELS: Record<FipeVehicleType, string> = {
  1: "Carros e utilitários",
  2: "Motos",
  3: "Caminhões e pesados",
};

export const FIPE_KIND_LABELS: Record<"version" | "family" | "none", string> = {
  version: "Versão",
  family: "Família",
  none: "Sem casamento",
};

export function fipeReasonLabel(reason: string | null): string {
  if (!reason) return "—";
  return FIPE_REASON_LABELS[reason] ?? reason;
}

export function formatDurationSec(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem === 0 ? `${min} min` : `${min} min ${rem}s`;
}
