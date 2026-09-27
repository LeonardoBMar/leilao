import { APP_TIME_ZONE } from "./format";

/**
 * Conversão entre o horário "de parede" digitado em `<input type="datetime-local">` / `type="date"`
 * e instantes UTC, sempre no fuso do app. Não depende do fuso do servidor nem do navegador.
 */

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function wallClockParts(date: Date) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return {
    year: parts.year ?? "",
    month: parts.month ?? "",
    day: parts.day ?? "",
    hour: parts.hour ?? "",
    minute: parts.minute ?? "",
  };
}

/** Diferença, em ms, entre o relógio de parede do fuso e UTC naquele instante. */
function zoneOffsetMs(date: Date): number {
  const p = wallClockParts(date);
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return wall - Math.floor(date.getTime() / 60_000) * 60_000;
}

/** "2026-10-02T10:00" (horário de Brasília) → instante UTC. `null` se inválido ou inexistente. */
export function zonedDateTimeToUtc(value: string): Date | null {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const wall = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);

  // Duas passadas cobrem mudanças de offset (horário de verão) perto do instante.
  let utc = wall - zoneOffsetMs(new Date(wall));
  utc = wall - zoneOffsetMs(new Date(utc));
  const result = new Date(utc);

  // Rejeita datas impossíveis (31/02) e horários que não existem no fuso.
  return toZonedDateTimeInput(result) === value ? result : null;
}

/** Instante UTC → "YYYY-MM-DDTHH:mm" no fuso do app, para `defaultValue` de `datetime-local`. */
export function toZonedDateTimeInput(date: Date): string {
  const p = wallClockParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Início do dia "YYYY-MM-DD" no fuso do app, em UTC. Base dos filtros por período. */
export function zonedStartOfDay(value: string): Date | null {
  return LOCAL_DATE.test(value) ? zonedDateTimeToUtc(`${value}T00:00`) : null;
}

/** Soma dias corridos a uma data "YYYY-MM-DD" (sem fuso). */
export function addDays(value: string, days: number): string | null {
  const match = LOCAL_DATE.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}
