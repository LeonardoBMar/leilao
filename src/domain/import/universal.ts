import type { DamageLevel } from "@/domain/listings/condition";
import type { PriceEstimate } from "@/domain/listings/estimates";
import type { MarketValueOrigin } from "@/domain/listings/fipe-match";
import { type Bps, bps, type Cents, cents, parseBRL } from "@/domain/money";
import { redactVehicleIds } from "@/sources/shared/redact";

/**
 * Parsers universais de lotes externos (D-98): extraem dados estruturados de páginas/textos de
 * leiloeiros brasileiros (Copart, Sodré Santoro, Freitas, Milan, Loop, VIP Leilões, Palácio dos Leilões
 * e extrator genérico via JSON-LD / OpenGraph / padrões BR), com redação obrigatória de placa/chassi/Renavam.
 */

export const IMPORT_PARSER_IDS = ["copart", "sodre", "freitas", "milan", "loop", "vip", "palacio", "generic"] as const;

export type ImportParserId = (typeof IMPORT_PARSER_IDS)[number];

export type ImportConfidence = "high" | "medium" | "low";

export type ParsedExternalLot = {
  parserId: ImportParserId;
  auctioneer: string;
  auctionName: string | null;
  lotNumber: string | null;
  brand: string | null;
  model: string | null;
  vehicleVersion: string | null;
  manufactureYear: number | null;
  modelYear: number | null;
  mileageKm: number | null;
  fuel: string | null;
  damageLevel: DamageLevel | null;
  currentBidCents: Cents | null;
  commissionRateBps: Bps | null;
  otherFeesCents: Cents | null;
  city: string | null;
  state: string | null;
  startsAtIso: string | null;
  lotUrl: string | null;
  notes: string | null;
  isMotorcycle: boolean;
  confidence: ImportConfidence;
};

/** Prévia do Importador Universal retornada pelo Passo 1 (D-98). */
export type ImportPreviewResult = {
  parsed: ParsedExternalLot;
  suggestedLotNumber: string;
  fipe: {
    value: Cents;
    fipeCode: string | null;
    refMonth: Date;
    origin: Extract<MarketValueOrigin, "fipe_version" | "fipe_family">;
    label: string;
  } | null;
  market: PriceEstimate | null;
};

type AuctioneerProfile = {
  id: Exclude<ImportParserId, "generic">;
  name: string;
  hosts: readonly string[];
  textPatterns: readonly RegExp[];
  defaultCommissionBps: Bps;
};

const AUCTIONEER_PROFILES: readonly AuctioneerProfile[] = [
  {
    id: "copart",
    name: "Copart Brasil",
    hosts: ["copart.com.br"],
    textPatterns: [/\bcopart\b/i],
    defaultCommissionBps: bps(500),
  },
  {
    id: "sodre",
    name: "Sodré Santoro",
    hosts: ["sodresantoro.com.br"],
    textPatterns: [/\bsodre\s+santoro\b/i],
    defaultCommissionBps: bps(500),
  },
  {
    id: "freitas",
    name: "Freitas Leiloeiro",
    hosts: ["freitasleiloeiro.com.br"],
    textPatterns: [/\bfreitas\s+leiloeiro\b/i],
    defaultCommissionBps: bps(500),
  },
  {
    id: "milan",
    name: "Milan Leilões",
    hosts: ["milanleiloes.com.br"],
    textPatterns: [/\bmilan\s+leiloes\b/i],
    defaultCommissionBps: bps(500),
  },
  {
    id: "loop",
    name: "Loop Leilões",
    hosts: ["loopleiloes.com.br", "loopbrasil.com"],
    textPatterns: [/\bloop\s+(?:leiloes|brasil)\b/i],
    defaultCommissionBps: bps(500),
  },
  {
    id: "vip",
    name: "VIP Leilões",
    hosts: ["vipleiloes.com.br"],
    textPatterns: [/\bvip\s+leiloes\b/i],
    defaultCommissionBps: bps(500),
  },
  {
    id: "palacio",
    name: "Palácio dos Leilões",
    hosts: ["palaciodosleiloes.com.br"],
    textPatterns: [/\bpalacio\s+dos\s+leiloes\b/i],
    defaultCommissionBps: bps(500),
  },
];

const CAR_BRANDS: ReadonlyArray<{ canonical: string; aliases: readonly string[] }> = [
  { canonical: "FIAT", aliases: ["FIAT"] },
  { canonical: "VOLKSWAGEN", aliases: ["VOLKSWAGEN", "VW"] },
  { canonical: "CHEVROLET", aliases: ["CHEVROLET", "GM", "GM - CHEVROLET"] },
  { canonical: "FORD", aliases: ["FORD"] },
  { canonical: "TOYOTA", aliases: ["TOYOTA"] },
  { canonical: "HONDA", aliases: ["HONDA"] },
  { canonical: "HYUNDAI", aliases: ["HYUNDAI"] },
  { canonical: "RENAULT", aliases: ["RENAULT"] },
  { canonical: "NISSAN", aliases: ["NISSAN"] },
  { canonical: "JEEP", aliases: ["JEEP"] },
  { canonical: "PEUGEOT", aliases: ["PEUGEOT"] },
  { canonical: "CITROEN", aliases: ["CITROEN", "CITROËN"] },
  { canonical: "MITSUBISHI", aliases: ["MITSUBISHI"] },
  { canonical: "KIA", aliases: ["KIA", "KIA MOTORS"] },
  { canonical: "BYD", aliases: ["BYD"] },
  { canonical: "CAOA CHERY", aliases: ["CAOA CHERY", "CHERY"] },
  { canonical: "BMW", aliases: ["BMW"] },
  { canonical: "MERCEDES-BENZ", aliases: ["MERCEDES-BENZ", "MERCEDES", "M.BENZ"] },
  { canonical: "AUDI", aliases: ["AUDI"] },
  { canonical: "VOLVO", aliases: ["VOLVO"] },
  { canonical: "RAM", aliases: ["RAM"] },
  { canonical: "SUZUKI", aliases: ["SUZUKI"] },
  { canonical: "LAND ROVER", aliases: ["LAND ROVER"] },
  { canonical: "SUBARU", aliases: ["SUBARU"] },
  { canonical: "JAC", aliases: ["JAC"] },
  { canonical: "GWM", aliases: ["GWM", "HAVAL"] },
];

const MOTO_BRANDS: ReadonlyArray<{ canonical: string; aliases: readonly string[] }> = [
  { canonical: "YAMAHA", aliases: ["YAMAHA"] },
  { canonical: "KAWASAKI", aliases: ["KAWASAKI"] },
  { canonical: "TRIUMPH", aliases: ["TRIUMPH"] },
  { canonical: "HARLEY-DAVIDSON", aliases: ["HARLEY-DAVIDSON", "HARLEY"] },
  { canonical: "DAFRA", aliases: ["DAFRA"] },
  { canonical: "HAOJUE", aliases: ["HAOJUE"] },
  { canonical: "ROYAL ENFIELD", aliases: ["ROYAL ENFIELD"] },
  { canonical: "SHINERAY", aliases: ["SHINERAY"] },
  { canonical: "BAJAJ", aliases: ["BAJAJ"] },
  { canonical: "DUCATI", aliases: ["DUCATI"] },
];

const ALL_BRANDS = [...CAR_BRANDS, ...MOTO_BRANDS];

const MOTO_MODEL_HINTS =
  /\b(?:cg\s*\d+|biz|bros|xre|cb\s*\d+|twister|pcx|nmax|fazer|factor|lander|crosser|mt-?0\d|ninja|z\d{3}|titan|fan\s*\d+|pop\s*\d+|motocicleta|moto)\b/i;

const BRAZILIAN_UFS = new Set([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
]);

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  aacute: "á",
  agrave: "à",
  atilde: "ã",
  acirc: "â",
  eacute: "é",
  ecirc: "ê",
  iacute: "í",
  oacute: "ó",
  otilde: "õ",
  ocirc: "ô",
  uacute: "ú",
  ccedil: "ç",
  Aacute: "Á",
  Atilde: "Ã",
  Acirc: "Â",
  Eacute: "É",
  Ecirc: "Ê",
  Iacute: "Í",
  Oacute: "Ó",
  Otilde: "Õ",
  Ocirc: "Ô",
  Uacute: "Ú",
  Ccedil: "Ç",
  ordm: "º",
  deg: "°",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-zA-Z]+);/g, (full, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full;
    }
    return NAMED_ENTITIES[entity] ?? full;
  });
}

/** Remove tags HTML de forma linear (inclusive `<script>`/`<style>` truncados) preservando texto útil. */
function stripHtmlToText(input: string): string {
  if (!input.includes("<")) return decodeHtmlEntities(input);
  const withoutScripts = input
    .replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?(?:<\/style\s*>|$)/gi, " ");
  let out = "";
  let inTag = false;
  for (let i = 0; i < withoutScripts.length; i += 1) {
    const ch = withoutScripts[i];
    if (ch === "<") {
      inTag = true;
      out += " ";
    } else if (ch === ">") {
      inTag = false;
    } else if (!inTag) {
      out += ch;
    }
  }
  return decodeHtmlEntities(out)
    .replace(/[ \t]+/g, " ")
    .replace(/\r?\n\s*\r?\n+/g, "\n")
    .trim();
}

type StructuredMeta = {
  title: string | null;
  description: string | null;
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  mileageKm: number | null;
  priceCents: Cents | null;
  url: string | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractStructuredMeta(html: string): StructuredMeta {
  const empty: StructuredMeta = {
    title: null,
    description: null,
    brand: null,
    model: null,
    modelYear: null,
    mileageKm: null,
    priceCents: null,
    url: null,
  };
  if (!html.includes("<")) return empty;

  const ogTitle =
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ??
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i.exec(html)?.[1] ??
    /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] ??
    null;
  const ogDesc =
    /<meta[^>]+(?:property=["']og:description["']|name=["']description["'])[^>]+content=["']([^"']+)["']/i.exec(
      html,
    )?.[1] ?? null;
  const ogUrl = /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ?? null;

  const result: StructuredMeta = {
    ...empty,
    title: ogTitle?.trim() || null,
    description: ogDesc?.trim() || null,
    url: normalizeUrl(ogUrl),
  };

  // JSON-LD (Vehicle / Car / Motorcycle / Product), suportando `@graph`
  const VEHICLE_LD_TYPES = new Set(["vehicle", "car", "motorcycle", "motorizedbicycle", "product"]);
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null = ldRe.exec(html);
  while (match !== null) {
    const rawJson = match[1]?.trim();
    if (rawJson) {
      try {
        const parsed: unknown = JSON.parse(rawJson);
        const rawNodes = Array.isArray(parsed) ? parsed : [parsed];
        const nodes: Record<string, unknown>[] = [];
        for (const item of rawNodes) {
          if (!isPlainObject(item)) continue;
          if (Array.isArray(item["@graph"])) {
            for (const graphNode of item["@graph"]) {
              if (isPlainObject(graphNode)) nodes.push(graphNode);
            }
          } else {
            nodes.push(item);
          }
        }
        for (const node of nodes) {
          const rawType = node["@type"];
          const types = Array.isArray(rawType)
            ? rawType.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase())
            : typeof rawType === "string"
              ? [rawType.toLowerCase()]
              : [];
          if (types.length > 0 && !types.some((t) => VEHICLE_LD_TYPES.has(t))) continue;

          if (typeof node.name === "string" && !result.title) result.title = decodeHtmlEntities(node.name.trim());
          if (typeof node.description === "string" && !result.description) {
            result.description = decodeHtmlEntities(node.description.trim());
          }
          if (typeof node.brand === "string") result.brand = node.brand.trim();
          else if (isPlainObject(node.brand)) {
            if (typeof node.brand.name === "string") result.brand = node.brand.name.trim();
          }
          if (typeof node.model === "string") result.model = node.model.trim();
          if (typeof node.vehicleModelDate === "number" || typeof node.vehicleModelDate === "string") {
            const yr = Number(node.vehicleModelDate);
            if (Number.isInteger(yr) && yr >= 1950 && yr <= 2035) result.modelYear = yr;
          }
          if (isPlainObject(node.mileageFromOdometer)) {
            const km = Number(node.mileageFromOdometer.value);
            if (Number.isFinite(km) && km >= 0 && km <= 2_000_000) result.mileageKm = Math.round(km);
          }
          if (node.offers && typeof node.offers === "object") {
            const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
            if (isPlainObject(offer)) {
              const price = offer.price;
              if (typeof price === "number" && Number.isFinite(price) && price > 0) {
                result.priceCents = cents(Math.round(price * 100));
              } else if (typeof price === "string") {
                const trimmedPrice = price.trim().replace(/[.,]+$/, "");
                if (/^\d+(?:\.\d{1,2})?$/.test(trimmedPrice)) {
                  const num = Number(trimmedPrice);
                  if (Number.isFinite(num) && num > 0) result.priceCents = cents(Math.round(num * 100));
                } else {
                  const parsedPrice = parseBRL(trimmedPrice);
                  if (parsedPrice !== null && parsedPrice > 0) result.priceCents = parsedPrice;
                }
              }
            }
          }
        }
      } catch {
        // Ignora blocos JSON-LD malformados
      }
    }
    match = ldRe.exec(html);
  }

  return result;
}

function detectAuctioneer(
  url: string | null,
  foldedText: string,
): {
  parserId: ImportParserId;
  auctioneer: string;
  defaultCommissionBps: Bps | null;
} {
  if (url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      for (const profile of AUCTIONEER_PROFILES) {
        if (profile.hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))) {
          return { parserId: profile.id, auctioneer: profile.name, defaultCommissionBps: profile.defaultCommissionBps };
        }
      }
    } catch {
      // ignore
    }
  }

  for (const profile of AUCTIONEER_PROFILES) {
    if (profile.textPatterns.some((pattern) => pattern.test(foldedText))) {
      return { parserId: profile.id, auctioneer: profile.name, defaultCommissionBps: profile.defaultCommissionBps };
    }
  }

  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./i, "");
      return { parserId: "generic", auctioneer: host, defaultCommissionBps: null };
    } catch {
      // ignore
    }
  }

  return { parserId: "generic", auctioneer: "Leiloeiro externo", defaultCommissionBps: null };
}

function findBrand(text: string): { brand: string; matchedToken: string; index: number } | null {
  const upper = fold(text).toUpperCase();
  for (const entry of ALL_BRANDS) {
    for (const alias of entry.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = new RegExp(`\\b${escaped}\\b`, "i").exec(upper);
      if (match) {
        return { brand: entry.canonical, matchedToken: alias, index: match.index };
      }
    }
  }
  return null;
}

function extractModelAndVersion(
  sourceLine: string,
  brandMatch: { matchedToken: string; index: number },
): { model: string | null; version: string | null } {
  const afterBrand = sourceLine
    .slice(brandMatch.index + brandMatch.matchedToken.length)
    .replace(/^[\s/\-–:]+/, "")
    .split(/\b(?:19\d{2}|20\d{2})\b|[|•\n,;]|\b(?:flex|gasolina|diesel|etanol|eletrico|hibrido|lote|km)\b/i)[0]
    ?.trim();

  if (!afterBrand || afterBrand.length < 2) return { model: null, version: null };

  const tokens = afterBrand.split(/\s+/).filter(Boolean);
  const model = tokens.slice(0, 2).join(" ").slice(0, 60);
  const version = tokens.length > 2 ? tokens.slice(2).join(" ").slice(0, 120) : null;
  return { model: model || null, version };
}

function extractYears(text: string): { manufactureYear: number | null; modelYear: number | null } {
  const slashMatch = /\b(19[5-9]\d|20[0-3]\d)\s*[/\-]\s*(19[5-9]\d|20[0-3]\d)\b/.exec(text);
  if (slashMatch) {
    const fab = Number(slashMatch[1]);
    const mod = Number(slashMatch[2]);
    if (mod >= fab && mod - fab <= 2) {
      return { manufactureYear: fab, modelYear: mod };
    }
  }

  const labeledMatch = /(?:ano(?:\s+modelo)?|modelo)\s*:?\s*(19[5-9]\d|20[0-3]\d)\b/i.exec(fold(text));
  if (labeledMatch) {
    return { manufactureYear: null, modelYear: Number(labeledMatch[1]) };
  }

  const standalone = /\b(19[8-9]\d|20[0-2]\d)\b/.exec(text);
  if (standalone) {
    return { manufactureYear: null, modelYear: Number(standalone[1]) };
  }

  return { manufactureYear: null, modelYear: null };
}

function extractMileage(text: string): number | null {
  const folded = fold(text);
  const patterns = [
    /(?:km|quilometragem|hodometro|odometro)\s*:?\s*(\d{1,3}(?:\.\d{3})+|\d{1,7})\b/i,
    /\b(\d{1,3}(?:\.\d{3})+|\d{2,6})\s*km\b/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(folded);
    if (match?.[1]) {
      const km = Number(match[1].replace(/\./g, ""));
      if (Number.isInteger(km) && km >= 0 && km <= 2_000_000) return km;
    }
  }
  return null;
}

function extractFuel(folded: string): string | null {
  if (/\bflex\b|alcool\/gasolina|gasolina\/alcool|etanol\/gasolina/i.test(folded)) return "Flex";
  if (/\bhibrid[oa]\b/i.test(folded)) return "Híbrido";
  if (/\beletric[oa]\b/i.test(folded)) return "Elétrico";
  if (/\bdiesel\b/i.test(folded)) return "Diesel";
  if (/\betanol\b|\balcool\b/i.test(folded)) return "Etanol";
  if (/\bgasolina\b/i.test(folded)) return "Gasolina";
  if (/\bgnv\b/i.test(folded)) return "GNV";
  return null;
}

function extractDamageLevel(folded: string): DamageLevel | null {
  if (/\bsucata\b|circulacao\s+vedada|baixa\s+definitiva/i.test(folded)) return "salvage";
  if (/\bgrande\s+monta\b/i.test(folded)) return "large";
  if (/\bmedia\s+monta\b/i.test(folded)) return "medium";
  if (/\bpequena\s+monta\b/i.test(folded)) return "small";
  return null;
}

function extractBidCents(folded: string): Cents | null {
  const moneyCapture = "r\\$\\s*(\\d+(?:\\.\\d{3})*(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";
  const labeledPatterns = [
    new RegExp(`(?:lance\\s+atual|maior\\s+lance|ultimo\\s+lance|valor\\s+atual)[^\\n;]{0,30}?${moneyCapture}`, "i"),
    new RegExp(`(?:lance\\s+inicial|valor\\s+inicial|avaliacao)[^\\n;]{0,30}?${moneyCapture}`, "i"),
  ];
  for (const pattern of labeledPatterns) {
    const match = pattern.exec(folded);
    if (match?.[1]) {
      const value = parseBRL(match[1].replace(/[.,]+$/, ""));
      if (value !== null && value > 0 && value <= 500_000_000) return value;
    }
  }
  return null;
}

function extractCommissionBps(folded: string): Bps | null {
  const match =
    /comissao[^;\n]{0,40}?(\d{1,2}(?:[.,]\d{1,2})?)\s*%|(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:de\s+)?comissao/i.exec(
      folded,
    );
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  const num = Number(raw.replace(",", "."));
  if (!Number.isFinite(num) || num <= 0 || num > 30) return null;
  return bps(Math.round(num * 100));
}

function extractAdminFeeCents(folded: string): Cents | null {
  const moneyCapture = "r\\$\\s*(\\d+(?:\\.\\d{3})*(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";
  const match = new RegExp(
    `(?:taxa\\s+(?:administrativa|de\\s+logistica|de\\s+patio|operacional)|despesas?\\s+(?:administrativas?|de\\s+logistica|de\\s+patio))[^;\\n]{0,60}?${moneyCapture}`,
    "i",
  ).exec(folded);
  if (!match?.[1]) return null;
  const value = parseBRL(match[1].replace(/[.,]+$/, ""));
  if (value === null || value <= 0 || value > 50_000_000) return null;
  return value;
}

function extractLocation(cleanText: string): { city: string | null; state: string | null } {
  const labeled =
    /(?:p[aá]tio|retirada(?:\s+em)?|local(?:iza[cç][aã]o)?|cidade)\s*:?\s*([A-Za-zÀ-ÿ\s]{2,40})[/\-–]\s*([A-Z]{2})\b/i.exec(
      cleanText,
    );
  if (labeled?.[1] && labeled[2] && BRAZILIAN_UFS.has(labeled[2].toUpperCase())) {
    return { city: labeled[1].trim(), state: labeled[2].toUpperCase() };
  }

  const generic = /\b([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý]?[a-zà-ÿ]+){0,2})\s*[/\-]\s*([A-Z]{2})\b/.exec(cleanText);
  if (generic?.[1] && generic[2] && BRAZILIAN_UFS.has(generic[2])) {
    return { city: generic[1].trim(), state: generic[2] };
  }

  return { city: null, state: null };
}

function extractDateIso(cleanText: string): string | null {
  const brMatch = /\b(\d{2})\/(\d{2})\/(20\d{2})(?:\s*(?:[aà]s|-)?\s*(\d{2}):(\d{2}))?/.exec(cleanText);
  if (!brMatch) return null;
  const day = Number(brMatch[1]);
  const month = Number(brMatch[2]);
  const year = Number(brMatch[3]);
  const hour = brMatch[4] ? Number(brMatch[4]) : 10;
  const minute = brMatch[5] ? Number(brMatch[5]) : 0;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  // Verifica data de calendário real (rejeita 31/02, 31/04, etc. antes do offset UTC-3).
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    return null;
  }
  const utc = new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0));
  if (Number.isNaN(utc.getTime())) return null;
  return utc.toISOString();
}

function extractLotNumber(cleanText: string, url: string | null): string | null {
  const textMatch = /\blote\s*(?:n[º°.]?\s*)?:?\s*#?\s*([A-Z0-9][A-Z0-9\-/]{0,19})\b/i.exec(cleanText);
  if (textMatch?.[1]) return textMatch[1].toUpperCase();

  if (url) {
    const urlMatch = /\/(?:lot|lote|veiculo|oferta)\/([A-Z0-9\-]{1,20})/i.exec(url);
    if (urlMatch?.[1]) return urlMatch[1].toUpperCase();
  }
  return null;
}

/**
 * Extrai dados estruturados de um lote externo a partir de texto colado, HTML e/ou URL do leiloeiro.
 * Redige placa completa, chassi e Renavam antes de retornar `notes`.
 */
export function parseExternalLot(input: { url?: string | null; content: string }): ParsedExternalLot {
  const meta = extractStructuredMeta(input.content);
  const lotUrl = normalizeUrl(input.url) ?? meta.url;
  const plain = stripHtmlToText(input.content);
  const combined = [meta.title, meta.description, plain].filter(Boolean).join("\n");
  const folded = fold(combined);

  const { parserId, auctioneer, defaultCommissionBps } = detectAuctioneer(lotUrl, folded);
  const lotNumber = extractLotNumber(combined, lotUrl);

  // Prioriza título estruturado / primeira linha (já redigido) para extração de marca e modelo
  const titleSource = redactVehicleIds(meta.title ?? plain.split("\n")[0] ?? combined);
  const brandFromMeta = meta.brand ? findBrand(meta.brand) : null;
  const brandInTitle = findBrand(titleSource);
  const brandMatch = brandFromMeta ?? brandInTitle ?? findBrand(combined);
  const brand = brandMatch?.brand ?? (meta.brand ? redactVehicleIds(meta.brand).toUpperCase().slice(0, 40) : null);

  let model = meta.model ? redactVehicleIds(meta.model) : null;
  let vehicleVersion: string | null = null;
  if (!model && brandMatch) {
    const lineForModel = brandInTitle ? titleSource : redactVehicleIds(combined);
    const matchInLine = brandInTitle ?? findBrand(lineForModel);
    if (matchInLine) {
      const extracted = extractModelAndVersion(lineForModel, matchInLine);
      model = extracted.model ? redactVehicleIds(extracted.model) : null;
      vehicleVersion = extracted.version ? redactVehicleIds(extracted.version) : null;
    }
  }

  const years = extractYears(combined);
  const modelYear = meta.modelYear ?? years.modelYear;
  const manufactureYear = years.manufactureYear;
  const mileageKm = meta.mileageKm ?? extractMileage(combined);
  const fuel = extractFuel(folded);
  const damageLevel = extractDamageLevel(folded);
  const currentBidCents = extractBidCents(folded) ?? meta.priceCents;
  const commissionRateBps = extractCommissionBps(folded) ?? defaultCommissionBps;
  const otherFeesCents = extractAdminFeeCents(folded);
  const { city, state } = extractLocation(combined);
  const startsAtIso = extractDateIso(combined);

  const isMotoBrand = brand !== null && MOTO_BRANDS.some((entry) => entry.canonical === brand);
  const isMotorcycle = isMotoBrand || MOTO_MODEL_HINTS.test(folded);

  const rawNotes = (meta.description ?? plain.slice(0, 600)).trim();
  const notes = rawNotes.length > 0 ? redactVehicleIds(rawNotes).slice(0, 1_500) : null;

  const auctionName = city && state ? `${auctioneer} — ${city}/${state}` : `${auctioneer} (importado)`;

  const coreCount = [brand, model, modelYear].filter((value) => value !== null).length;
  const confidence: ImportConfidence =
    coreCount === 3 && (currentBidCents !== null || lotNumber !== null) ? "high" : coreCount >= 2 ? "medium" : "low";

  return {
    parserId,
    auctioneer,
    auctionName,
    lotNumber,
    brand,
    model,
    vehicleVersion,
    manufactureYear,
    modelYear,
    mileageKm,
    fuel,
    damageLevel,
    currentBidCents,
    commissionRateBps,
    otherFeesCents,
    city,
    state,
    startsAtIso,
    lotUrl,
    notes,
    isMotorcycle,
    confidence,
  };
}
