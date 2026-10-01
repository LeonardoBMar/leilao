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

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return parseJson(html.slice(start, i + 1));
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

function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return null;
  }
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

/** Valor em reais vindo da fonte (ex.: 23900 ou 41247.5) para centavos inteiros. */
export function reaisToCents(value: number): Cents {
  return cents(Math.round(value * 100));
}
