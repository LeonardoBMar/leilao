import type { Cents } from "@/domain/money";

export const APP_TIME_ZONE = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactBrl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  // Mínimo explícito: o Intl do Node 22 aplica o mínimo de moeda (2 → 1) e escreve "R$ 850,0".
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: APP_TIME_ZONE });
const shortMonth = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatBRL(value: Cents): string {
  return brl.format(value / 100);
}

/** Valor para um campo de dinheiro, que `parseBRL` lê de volta: "1234,50" (sem milhar nem "R$"). */
export function formatMoneyInput(value: Cents): string {
  return (value / 100).toFixed(2).replace(".", ",");
}

/** Valor curto para gráficos: "R$ 32,5 mil", "R$ 1,3 mi". */
export function formatCompactBRL(value: Cents): string {
  return compactBrl.format(value / 100);
}

/** Quilometragem: "55.493 km". */
export function formatKm(value: number): string {
  return `${integer.format(value)} km`;
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

const calendarDayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

/** Dia e mês de uma data de calendário, para eixos (ex.: início da semana): "06/10". */
export function formatCalendarDayMonth(value: Date): string {
  return calendarDayMonth.format(value);
}

/** Mês de referência (ex.: FIPE): "outubro de 2026". */
export function formatMonth(value: Date): string {
  return calendarMonth.format(value);
}

/** Mês de referência curto, para rótulos (ex.: origem do valor de mercado): "out/2026". */
export function formatShortMonth(value: Date): string {
  const parts = shortMonth.formatToParts(value);
  const month = parts.find((part) => part.type === "month")?.value.replace(".", "") ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return `${month}/${year}`;
}

/** Pontos-base como percentual: 525 → "5,25%". */
export function formatBps(value: number): string {
  return percent.format(value / 10_000);
}

/** Proporção como porcentagem inteira: 0,534 → "53%" (ex.: lance final ÷ valor de mercado). */
export function formatRatio(value: number): string {
  return percent.format(Math.round(value * 100) / 100);
}

const dayParts = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  weekday: "long",
  timeZone: APP_TIME_ZONE,
});
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE });
const shortDateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

/** Partes de um dia para agendas: { key: "2030-10-02", day: "02", month: "out 2030", weekday: "quarta" }. */
export function formatDayParts(value: Date): { key: string; day: string; month: string; weekday: string } {
  const parts = Object.fromEntries(dayParts.formatToParts(value).map((part) => [part.type, part.value]));
  const month = (parts.month ?? "").replace(".", "");
  return {
    key: `${parts.year}-${month}-${parts.day}`,
    day: parts.day ?? "",
    month: `${month} ${parts.year ?? ""}`,
    weekday: (parts.weekday ?? "").replace("-feira", ""),
  };
}

/** Só a hora: "10:00". */
export function formatTime(value: Date): string {
  return time.format(value);
}

/** Data e hora com mês abreviado: "02 de out. de 2030, 10:00" → "02 out 2030, 10:00". */
export function formatShortDateTime(value: Date): string {
  const parts = Object.fromEntries(shortDateTime.formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.day} ${(parts.month ?? "").replace(".", "")} ${parts.year}, ${parts.hour}:${parts.minute}`;
}

/** Data e hora sem ano, para cabeçalhos e KPIs compactos: "02 out, 10:00". */
export function formatCompactDateTime(value: Date): string {
  const parts = Object.fromEntries(shortDateTime.formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.day} ${(parts.month ?? "").replace(".", "")}, ${parts.hour}:${parts.minute}`;
}
