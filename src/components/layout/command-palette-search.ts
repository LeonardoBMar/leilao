/**
 * Normalização e correspondência textual da paleta de comandos (`⌘K`, D-87):
 * insensível a acentos/diacríticos e tolerante a múltiplas palavras em qualquer ordem.
 */

export function normalizeCommandText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function matchesCommandQuery(fields: readonly (string | undefined)[], normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = fields.map((field) => (field ? normalizeCommandText(field) : "")).join(" ");
  return tokens.every((token) => haystack.includes(token));
}
