import { type Cents, cents } from "@/domain/money";

/**
 * Extração de dados de páginas HTML (D-27). Funções puras, sem parser de HTML:
 * leem blocos JSON que as próprias páginas publicam ou, quando a fonte não publica nenhum, trechos de texto.
 */

/**
 * Lê o objeto JSON atribuído a `marker` num `<script>` (ex.: `window.__INITIAL_STATE__={...};`).
 * Percorre as chaves respeitando strings, porque o objeto pode vir seguido de mais código na mesma linha.
 * Devolve `null` se o marcador não existir ou o JSON for inválido.
 */
export function extractAssignedJson(html: string, marker: string): unknown {
  const markerAt = html.indexOf(marker);
  if (markerAt < 0) return null;
  const start = html.indexOf("{", markerAt + marker.length);
  if (start < 0) return null;
  return extractBalancedJson(html, start);
}

/**
 * Decodifica os blocos `self.__next_f.push([1,"..."])` (Next.js App Router / RSC Flight) de uma página HTML
 * e extrai o objeto ou array JSON associado à chave `key` (ex.: `"initialLote"`).
 */
export function extractNextFlightJson(html: string, key: string): unknown {
  const chunks: string[] = [];
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g)) {
    const raw = match[1];
    if (raw === undefined) continue;
    const decoded = parseJson(`"${raw}"`);
    if (typeof decoded === "string") chunks.push(decoded);
  }
  if (chunks.length === 0) return null;

  const flight = chunks.join("");
  const needle = `"${key}":`;
  const idx = flight.indexOf(needle);
  if (idx < 0) return null;

  let start = idx + needle.length;
  while (start < flight.length && /\s/.test(flight[start] ?? "")) start++;
  const open = flight[start];
  if (open !== "{" && open !== "[") return null;
  return extractBalancedJson(flight, start);
}

function extractBalancedJson(source: string, start: number): unknown {
  const open = source[start];
  const close = open === "[" ? "]" : "}";
  if (open !== "{" && open !== "[") return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth++;
    else if (char === close) {
      depth--;
      if (depth === 0) {
        const raw = source.slice(start, i + 1);
        return parseJson(raw) ?? parseJson(normalizeJsObjectLiteral(raw));
      }
    }
  }
  return null;
}

/** Todos os blocos `<script type="application/ld+json">` da página; blocos inválidos são ignorados. */
export function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    const parsed = parseJson(match[1] ?? "");
    if (Array.isArray(parsed)) blocks.push(...parsed);
    else if (parsed !== null) blocks.push(parsed);
  }
  return blocks;
}

/** Faz parse de JSON retornando `null` em caso de erro de sintaxe. */
export function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return null;
  }
}

/**
 * Converte literais JS comuns em estados SSR (`undefined`, `new Date("...")`, `NaN`, `Infinity`) para JSON válido,
 * percorrendo fora de strings (sem `eval` nem `new Function`).
 */
function normalizeJsObjectLiteral(src: string): string {
  let out = "";
  let i = 0;
  const isIdentChar = (ch: string | undefined) => ch !== undefined && /[A-Za-z0-9_$]/.test(ch);

  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === '"') {
          j += 1;
          break;
        }
        j += 1;
      }
      out += src.slice(i, j);
      i = j;
      continue;
    }
    if (src.startsWith("undefined", i) && !isIdentChar(src[i - 1]) && !isIdentChar(src[i + 9])) {
      out += "null";
      i += 9;
      continue;
    }
    if (src.startsWith("NaN", i) && !isIdentChar(src[i - 1]) && !isIdentChar(src[i + 3])) {
      out += "null";
      i += 3;
      continue;
    }
    if (src.startsWith("Infinity", i) && !isIdentChar(src[i - 1]) && !isIdentChar(src[i + 8])) {
      out += "null";
      i += 8;
      continue;
    }
    if (src.startsWith("new Date(", i) && !isIdentChar(src[i - 1])) {
      const close = src.indexOf(")", i + 9);
      if (close > i + 9) {
        const inner = src.slice(i + 9, close).trim();
        out += inner.startsWith('"') && inner.endsWith('"') ? inner : "null";
        i = close + 1;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ordm: "º",
  ordf: "ª",
  deg: "°",
};
/** Acentos que as páginas escrevem como entidade (`&atilde;`, `&Ccedil;`): letra + marca combinante. */
const ACCENTS: Record<string, string> = {
  acute: "\u0301",
  grave: "\u0300",
  circ: "\u0302",
  tilde: "\u0303",
  uml: "\u0308",
  cedil: "\u0327",
};

/** Troca entidades HTML (nomeadas comuns, de acento e numéricas) pelo caractere. Entidade desconhecida fica como está. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name.startsWith("#")) {
      const hex = name[1] === "x" || name[1] === "X";
      const code = hex ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    const named = NAMED_ENTITIES[name];
    if (named !== undefined) return named;
    const accent = /^([a-z])(acute|grave|circ|tilde|uml|cedil)$/i.exec(name);
    const mark = accent?.[2] ? ACCENTS[accent[2]] : undefined;
    return accent?.[1] && mark ? `${accent[1]}${mark}`.normalize("NFC") : entity;
  });
}

/**
 * Trecho de HTML como linhas de texto: `<br>`, `<p>` e `<div>` quebram linha, as demais tags somem, entidades viram
 * caracteres e linhas vazias saem.
 */
export function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(br|\/p|\/div|\/li|\/h\d)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  return decodeHtmlEntities(text)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");
}

/** Horário de Brasília (UTC−3, sem horário de verão desde 2019). */
export const BRASILIA_OFFSET_HOURS = 3;

export function brasiliaDateUtc(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}): Date | null {
  const { year, month, day, hour, minute, second = 0 } = parts;
  if (![year, month, day, hour, minute, second].every(Number.isInteger) || year < 1900) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour + BRASILIA_OFFSET_HOURS, minute, second));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Converte "DD/MM/AAAA HH:MM[:SS]" ou "AAAA-MM-DD HH:MM[:SS]" em horário de Brasília para UTC. */
export function parseBrasiliaDateTime(text: string): Date | null {
  const trimmed = text.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  const parts = iso
    ? [iso[1], iso[2], iso[3], iso[4], iso[5], iso[6]]
    : br
      ? [br[3], br[2], br[1], br[4], br[5], br[6]]
      : [];
  if (!parts[0] || !parts[1] || !parts[2] || !parts[3] || !parts[4]) return null;
  return brasiliaDateUtc({
    year: Number(parts[0]),
    month: Number(parts[1]),
    day: Number(parts[2]),
    hour: Number(parts[3]),
    minute: Number(parts[4]),
    second: Number(parts[5] ?? 0),
  });
}

/** Valor em reais vindo da fonte (ex.: 23900 ou 41247.5) para centavos inteiros. */
export function reaisToCents(value: number): Cents {
  return cents(Math.round(value * 100));
}

/** Remove tags HTML, decodifica entidades e colapsa espaços em uma única linha. */
export function htmlToText(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto aparado, ou `null` quando ausente ou vazio. */
export function nonEmpty(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** Remove strings vazias e duplicadas preservando a ordem da primeira ocorrência. */
export function uniqueNonEmpty(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value !== ""))];
}

/** Escapa metacaracteres de expressão regular para busca literal. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove diacríticos, converte para maiúsculas e apara espaços nas bordas. */
export function plainUpper(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/** Ano de 4 dígitos entre 1900 e `maxYear` (padrão 2100); inválido ou fora da faixa vira `null`. */
export function parseYear(value: string | number | null | undefined, maxYear = 2100): number | null {
  if (value == null) return null;
  const year = typeof value === "number" ? value : /^\d{4}$/.test(value.trim()) ? Number(value.trim()) : Number.NaN;
  return Number.isInteger(year) && year >= 1900 && year <= maxYear ? year : null;
}
