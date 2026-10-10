import { toZonedDateInput, zonedDateTimeToUtc } from "@/lib/dates";

/**
 * Dia do desfecho escolhido no formulário ("YYYY-MM-DD", horário de Brasília) → instante gravado em `eventAt`.
 * Se uma referência conhecida (fim do anúncio, data do leilão, desfecho já registrado) cai nesse dia, vale o horário
 * dela: assim uma análise fixada de manhã para um leilão à tarde continua anterior ao desfecho (SPEC §10). Sem
 * referência, vale o fim do dia, ou agora se o dia é hoje. Dia futuro ou inválido: `null`.
 */
export function resolveEventAt(day: string, references: readonly (Date | null)[], now: Date): Date | null {
  const start = zonedDateTimeToUtc(`${day}T00:00`);
  const end = zonedDateTimeToUtc(`${day}T23:59`);
  if (!start || !end || start > now) return null;

  const reference = references.find((date) => date !== null && date <= now && toZonedDateInput(date) === day);
  if (reference) return reference;
  return end < now ? end : now;
}
