import { inflateRawSync, inflateSync } from "node:zlib";

/**
 * Extrator leve e linear O(N) de texto de PDFs no servidor (D-97), sem dependências externas.
 * Suporta streams sem compressão e streams `FlateDecode` (zlib) com operadores `Tj`/`TJ`,
 * com limites rígidos de memória cumulativa, contagem de streams e tamanho de saída (anti-DoS).
 */

export const MAX_PDF_BYTES = 4 * 1024 * 1024; // 4 MB (folga dentro do limite 4,5 MB da Vercel)
const MAX_DECOMPRESSED_STREAM_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_DECOMPRESSED_BYTES = 16 * 1024 * 1024;
const MAX_STREAMS = 500;
const MAX_EXTRACTED_CHARS = 250_000;

function decodePdfLiteral(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) break;
    i += 1;
    switch (next) {
      case "n":
        out += "\n";
        break;
      case "r":
        out += "\r";
        break;
      case "t":
        out += "\t";
        break;
      case "b":
      case "f":
        out += " ";
        break;
      case "(":
      case ")":
      case "\\":
        out += next;
        break;
      default: {
        const octalMatch = /^[0-7]{1,3}/.exec(raw.slice(i));
        if (octalMatch) {
          out += String.fromCharCode(Number.parseInt(octalMatch[0], 8));
          i += octalMatch[0].length - 1;
        } else {
          out += next;
        }
      }
    }
  }
  return out;
}

function decodeHexString(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  if (clean.length < 2) return "";
  const padded = clean.length % 2 === 1 ? `${clean}0` : clean;
  const bytes = Buffer.from(padded, "hex");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      const code = ((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0);
      out += String.fromCharCode(code);
    }
    return out;
  }
  return bytes.toString("latin1");
}

function readBalancedParen(text: string, openIndex: number): { value: string; nextIndex: number } | null {
  let depth = 1;
  let i = openIndex + 1;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    i += 1;
  }
  if (depth !== 0) return null;
  return { value: text.slice(openIndex + 1, i - 1), nextIndex: i };
}

function skipSpaces(text: string, index: number): number {
  let i = index;
  while (i < text.length && (text[i] === " " || text[i] === "\t" || text[i] === "\r" || text[i] === "\n")) i += 1;
  return i;
}

/** Scanner linear O(N) de operadores `Tj` e `TJ` dentro de um content stream PDF. */
function extractTextFromContentStream(streamText: string, budgetChars: number): string {
  const chunks: string[] = [];
  let charCount = 0;

  let i = 0;
  const len = streamText.length;
  while (i < len && charCount < budgetChars) {
    const ch = streamText[i];

    if (ch === "(") {
      const parsed = readBalancedParen(streamText, i);
      if (!parsed) break;
      const after = skipSpaces(streamText, parsed.nextIndex);
      if (streamText.startsWith("Tj", after)) {
        const decoded = decodePdfLiteral(parsed.value);
        chunks.push(decoded);
        charCount += decoded.length + 1;
        i = after + 2;
        continue;
      }
      i = parsed.nextIndex;
      continue;
    }

    if (ch === "<" && streamText[i + 1] !== "<") {
      const close = streamText.indexOf(">", i + 1);
      if (close === -1) break;
      const after = skipSpaces(streamText, close + 1);
      if (streamText.startsWith("Tj", after)) {
        const decoded = decodeHexString(streamText.slice(i + 1, close));
        chunks.push(decoded);
        charCount += decoded.length + 1;
        i = after + 2;
        continue;
      }
      i = close + 1;
      continue;
    }

    if (ch === "[") {
      const parts: string[] = [];
      let j = i + 1;
      let closed = false;
      while (j < len) {
        const inner = streamText[j];
        if (inner === "]") {
          closed = true;
          j += 1;
          break;
        }
        if (inner === "(") {
          const parsed = readBalancedParen(streamText, j);
          if (!parsed) break;
          parts.push(decodePdfLiteral(parsed.value));
          j = parsed.nextIndex;
          continue;
        }
        if (inner === "<" && streamText[j + 1] !== "<") {
          const close = streamText.indexOf(">", j + 1);
          if (close === -1) break;
          parts.push(decodeHexString(streamText.slice(j + 1, close)));
          j = close + 1;
          continue;
        }
        j += 1;
      }
      if (!closed) break;
      const after = skipSpaces(streamText, j);
      if (streamText.startsWith("TJ", after) && parts.length > 0) {
        const joined = parts.join("");
        chunks.push(joined);
        charCount += joined.length + 1;
        i = after + 2;
        continue;
      }
      i = j;
      continue;
    }

    i += 1;
  }

  return chunks.join(" ");
}

function tryDecompress(bytes: Buffer, maxOutputLength: number): Buffer {
  try {
    return inflateSync(bytes, { maxOutputLength });
  } catch {
    try {
      return inflateRawSync(bytes, { maxOutputLength });
    } catch {
      return bytes;
    }
  }
}

/**
 * Extrai texto legível de um arquivo PDF em memória em tempo linear.
 * Retorna `""` se o arquivo exceder o limite, não for PDF ou não contiver texto selecionável.
 */
export function extractPdfText(buffer: Buffer): string {
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_PDF_BYTES) return "";
  if (!buffer.subarray(0, 8).toString("latin1").includes("%PDF-")) return "";

  const latin1 = buffer.toString("latin1");
  const extractedParts: string[] = [];
  let totalDecompressed = 0;
  let totalChars = 0;
  let streamCount = 0;
  let cursor = 0;

  while (cursor < latin1.length && streamCount < MAX_STREAMS && totalChars < MAX_EXTRACTED_CHARS) {
    const streamToken = latin1.indexOf("stream", cursor);
    if (streamToken === -1) break;

    let bodyStart = streamToken + 6;
    if (latin1[bodyStart] === "\r" && latin1[bodyStart + 1] === "\n") {
      bodyStart += 2;
    } else if (latin1[bodyStart] === "\n") {
      bodyStart += 1;
    } else {
      cursor = bodyStart;
      continue;
    }

    const endToken = latin1.indexOf("endstream", bodyStart);
    if (endToken === -1) break;

    let bodyEnd = endToken;
    if (bodyEnd > bodyStart && latin1[bodyEnd - 1] === "\n") bodyEnd -= 1;
    if (bodyEnd > bodyStart && latin1[bodyEnd - 1] === "\r") bodyEnd -= 1;

    cursor = endToken + 9;
    streamCount += 1;

    if (bodyEnd <= bodyStart) continue;

    const headerWindow = latin1.slice(Math.max(0, streamToken - 220), streamToken);
    const isFlate = /\/FlateDecode\b/.test(headerWindow);
    const rawBody = latin1.slice(bodyStart, bodyEnd);

    let content = rawBody;
    if (isFlate) {
      const remainingBudget = MAX_TOTAL_DECOMPRESSED_BYTES - totalDecompressed;
      if (remainingBudget <= 0) break;
      const limit = Math.min(MAX_DECOMPRESSED_STREAM_BYTES, remainingBudget);
      const decompressed = tryDecompress(Buffer.from(rawBody, "latin1"), limit);
      totalDecompressed += decompressed.byteLength;
      content = decompressed.toString("latin1");
    }

    const text = extractTextFromContentStream(content, MAX_EXTRACTED_CHARS - totalChars);
    if (text.trim().length > 0) {
      extractedParts.push(text);
      totalChars += text.length + 1;
    }
  }

  return extractedParts
    .join("\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}
