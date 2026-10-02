/**
 * Identificadores do veículo que não guardamos (decisão do usuário, docs/PLANO-COLETA.md §2.2): placa completa,
 * chassi e Renavam, que alguns leiloeiros escrevem na descrição. Placa já mascarada pela fonte ("E__-___2") fica.
 */
const PLATE = /\b[A-Z]{3}[- ]?\d[A-Z0-9]\d{2}\b/gi;
/** Chassi (VIN): 17 letras e números, sem I, O e Q, com pelo menos um de cada. */
const CHASSIS = /\b(?=[A-HJ-NPR-Z0-9]*\d)(?=[A-HJ-NPR-Z0-9]*[A-HJ-NPR-Z])[A-HJ-NPR-Z0-9]{17}\b/gi;
const RENAVAM = /\b(RENAVAM)(\s*(?:N[º°O.]*)?\s*:?\s*)\d{9,11}\b/gi;

export const REDACTED = "[removido]";

/** Troca placa completa, chassi e Renavam por `[removido]`; o resto do texto fica igual. */
export function redactVehicleIds(text: string): string {
  return text.replace(RENAVAM, `$1$2${REDACTED}`).replace(CHASSIS, REDACTED).replace(PLATE, REDACTED);
}
