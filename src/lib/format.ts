import type { Cents } from "@/domain/money";

export const APP_TIME_ZONE = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: APP_TIME_ZONE });

export function formatBRL(value: Cents): string {
  return brl.format(value / 100);
}

export function formatDateTime(value: Date): string {
  return dateTime.format(value);
}

export function formatDate(value: Date): string {
  return date.format(value);
}
