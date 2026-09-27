import { type Cents, cents } from "@/domain/money";

/**
 * Extração de dados estruturados de páginas HTML (D-27). Funções puras, sem parser de HTML:
 * só leem blocos JSON que as próprias páginas publicam.
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

/** Valor em reais vindo da fonte (ex.: 23900 ou 41247.5) para centavos inteiros. */
export function reaisToCents(value: number): Cents {
  return cents(Math.round(value * 100));
}
