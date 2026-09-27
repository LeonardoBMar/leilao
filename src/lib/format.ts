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

// Datas de calendário (colunas `date`, sem hora) são meia-noite UTC: formatar em UTC para não voltar um dia.
const calendarDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
const calendarMonth = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Data sem hora (ex.: data da referência de mercado). */
export function formatCalendarDate(value: Date): string {
  return calendarDate.format(value);
}

/** Mês de referência (ex.: FIPE): "outubro de 2026". */
export function formatMonth(value: Date): string {
  return calendarMonth.format(value);
}

/** Pontos-base como percentual: 525 → "5,25%". */
export function formatBps(value: number): string {
  return percent.format(value / 10_000);
}
