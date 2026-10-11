import { cleanDescription, normalizeNotes, parseConditionNotes, worstDamage } from "@/domain/listings/condition";
import { stateCode } from "@/domain/listings/place";
import type { ListingCategory, ListingInput, ListingStatus } from "@/domain/listings/types";
import { bps, type Cents } from "@/domain/money";

import { LEILOES_FREIRE_IMAGE_ORIGIN } from "../image-origins";
import { splitDetranVehicle } from "../shared/detran-vehicle";
import { decodeHtmlEntities, reaisToCents } from "../shared/extract";
import { redactVehicleIds } from "../shared/redact";
import { categoryOfVehicle, isKnownVehicleBrand } from "../shared/vehicle-category";
import type { ListingDetails } from "../types";
import {
  type FreirePageAuction,
  freirePageAuctionSchema,
  type FreirePageLot,
  freirePageLotSchema,
  type FreireRaw,
  freireRawSchema,
} from "./schema";

export const LEILOES_FREIRE_BASE_URL = "https://www.leiloesfreire.com.br";
export const LEILOES_FREIRE_NAME = "Leilões Freire";

/** Leilões abertos (a mesma lista da página inicial). */
export const LEILOES_FREIRE_AUCTIONS_URL = `${LEILOES_FREIRE_BASE_URL}/leiloes`;

/** Anúncio = lote, pelo id do site, que não muda de leilão. */
export const leiloesFreireListingUrl = (lotId: string) => `${LEILOES_FREIRE_BASE_URL}/leilao/lote/${lotId}`;

export const leiloesFreireAuctionUrl = (auctionId: string) => `${LEILOES_FREIRE_BASE_URL}/leilao/${auctionId}`;

/**
 * Situação do lote (`situacao`), conferida em ~1.600 lotes de 80 leilões (06 a 10/2026): 1 "Aguardando Lance" (antes do
 * pregão; depois do fim do leilão, ficou sem venda), 2 "Em disputa", 3 "Retirado", 5 "Vendido". O resto não é
 * adivinhado.
 */
const AWAITING_BID = 1;
const STATUS_BY_CODE: Record<number, ListingStatus> = { 2: "open", 3: "withdrawn", 5: "sold" };
/** `situacao` do leilão encerrado. */
const AUCTION_CLOSED = 5;

/** Tipo antes da marca ("MICRO-ÔNIBUS IVECO/…", "CAMINHÃO FORD CARGO", "SUCATA DE MOTO HONDA …"): não é marca. */
const VEHICLE_TYPE =
  /^(?:\d+\s+)?(?:SUCATA\s+DE\s+)?(?:MICRO[- ]?[OÔ]NIBUS|[OÔ]NIBUS|CAMINH[AÃ]O(?:\s+(?:TRATOR|BA[UÚ]|PIPA|CA[CÇ]AMBA|TOCO|TRUCK))?|CAVALO\s+MEC[AÂ]NICO|CAMINHONETE|AMBUL[AÂ]NCIA|MOTOCICLETA|MOTO|VE[IÍ]CULO)\s+/;
const HEAVY_TYPE =
  /^(?:\d+\s+)?(?:SUCATA\s+DE\s+)?(?:MICRO[- ]?[OÔ]NIBUS|[OÔ]NIBUS|CAMINH[AÃ]O|CAVALO\s+MEC[AÂ]NICO)\b/;
const MOTO_TYPE = /^(?:\d+\s+)?(?:SUCATA\s+DE\s+)?MOTO(?:CICLETA)?\b/;

/** Ids dos leilões da lista, na ordem do site, sem repetir. `null`: a página não é a lista (o site mudou). */
export function parseLeiloesFreireAuctions(html: string): string[] | null {
  if (!/LEIL(?:Õ|&Otilde;)ES|Leil(?:õ|&otilde;)es/.test(html) || !html.includes("leiloesfreire")) return null;
  return unique([...html.matchAll(/leiloesfreire\.com\.br\/leilao\/(\d+)["/]/g)].map(([, id]) => id ?? ""));
}

/** Primeiro lote da página do leilão: a página dele traz o leilão inteiro. `null`: leilão sem lotes à mostra. */
export function firstLotOfAuctionPage(html: string): string | null {
  return /leiloesfreire\.com\.br\/leilao\/lote\/(\d+)/.exec(html)?.[1] ?? null;
}

/**
 * Página de um lote: o leilão com todos os lotes (`:data-leilao`) e o "Local do Leilão". Cada lote vira o dado bruto
 * do anúncio. `null`: falta o leilão ou ele está fora do formato (o site mudou).
 */
export function parseLeiloesFreireLotPage(html: string): FreireRaw[] | null {
  const auction = freirePageAuctionSchema.safeParse(attributeJson(html, ":data-leilao"));
  if (!auction.success) return null;
  const place = nonEmpty(
    plain(/Local do Leil(?:ã|&atilde;)o:<\/b><\/p>\s*<p[^>]*>([\s\S]*?)<\/(?:p|div)>/.exec(html)?.[1] ?? ""),
  );
  // O lote da página vem também em `:data-lote`, às vezes mais novo que a cópia na lista do leilão.
  const own = freirePageLotSchema.safeParse(attributeJson(html, ":data-lote"));
  const lots = auction.data.lotes.map((lot) => (own.success && own.data.id === lot.id ? own.data : lot));
  return lots.map((lot) => rawOf(auction.data, lot, place));
}

function rawOf(auction: FreirePageAuction, lot: FreirePageLot, place: string | null): FreireRaw {
  return {
    lotId: String(lot.id),
    auctionId: String(auction.id),
    auctionTitle: nonEmpty(plain(auction.titulo ?? "")),
    auctionStartsAt: auction.data_leilao,
    auctionEndsAt: auction.data_fim_leilao,
    auctionStatus: auction.situacao,
    place,
    lotNumber: nonEmpty(lot.lote ?? ""),
    // Placa, chassi e Renavam saem já aqui: nem o `raw` os guarda (D-40).
    description: redactVehicleIds(plain(lot.descricao ?? lot.nome ?? "")),
    statusCode: lot.situacao,
    statusText: nonEmpty(lot.situacao_situacao ?? ""),
    bid: moneyText(lot.valor_lance),
    appraisal: moneyText(lot.valor_avaliacao),
    minimumBid: moneyText(lot.valor_lance_minimo),
    commissionPercent: moneyText(lot.porcentagem_leiloeiro),
    photos: photosOf(lot.midia),
  };
}

/**
 * Lote de veículo: a descrição traz "ANO/MOD" (ou "ANO/MODELO") ou a placa. Máquinas ("RETROESCAVADEIRA …, ANO 2011"),
 * materiais e imóveis ficam de fora.
 */
export function isFreireVehicle(description: string): boolean {
  const text = normalizeNotes(description);
  return /\bANO\s*\/\s*MO[DB]/.test(text) || /\bPLACA\b\s*:?\s*(?:\[REMOVIDO\]|[A-Z]{3}-?\d|S\/INFO)/.test(text);
}

function attributeJson(html: string, name: string): unknown {
  const value = new RegExp(`${name}="([^"]*)"`).exec(html)?.[1];
  if (value === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(decodeHtmlEntities(value));
    return parsed;
  } catch {
    return null;
  }
}

/** `midia` é um JSON com os caminhos ("lotes/September2026/x.jpeg") dentro de `/storage/`. */
function photosOf(midia: string | null): string[] {
  if (midia === null) return [];
  try {
    const paths: unknown = JSON.parse(midia);
    if (!Array.isArray(paths)) return [];
    return unique(
      paths
        .filter((path): path is string => typeof path === "string" && /^lotes\/[\w/.-]+$/.test(path))
        .map((path) => `${LEILOES_FREIRE_IMAGE_ORIGIN}/storage/${path}`),
    );
  } catch {
    return [];
  }
}

/** Dado bruto → anúncio no formato único. */
export function buildLeiloesFreireListing(raw: FreireRaw, now: Date): ListingInput {
  const vehicle = parseLeiloesFreireDescription(raw.description, now);
  const startsAt = isoDate(raw.auctionStartsAt);
  const endsAt = isoDate(raw.auctionEndsAt) ?? startsAt;
  const status = mapStatus(raw, endsAt, now);
  const bid = money(raw.bid);
  const commission = raw.commissionPercent === null ? null : Number(raw.commissionPercent);

  return {
    externalId: raw.lotId,
    url: leiloesFreireListingUrl(raw.lotId),
    lotNumber: raw.lotNumber,
    title: vehicle.name || "Lote sem descrição",
    vehicle: {
      brand: vehicle.brand,
      model: vehicle.model,
      fipeCode: null,
      fipeName: null,
      modelYear: vehicle.modelYear,
      manufactureYear: vehicle.manufactureYear,
      mileageKm: null,
      fuel: vehicle.fuel,
      color: vehicle.color,
      category: vehicle.category,
      recoveryType: null,
      hasKey: null,
    },
    auction: { externalId: raw.auctionId, name: raw.auctionTitle, startsAt },
    sellerName: sellerOf(raw.auctionTitle),
    description: cleanDescription(raw.description),
    condition: conditionOf(raw.description),
    startsAt: null,
    endsAt,
    location: placeOf(raw.auctionTitle, raw.place),
    status,
    sourceStatus: raw.statusText,
    // O site não diz quantos lances houve, só o último.
    currentBid: bid,
    // "Lance mínimo" quase nunca vem; a avaliação é o valor de partida do pregão (não é valor de mercado).
    minimumBid: money(raw.minimumBid) ?? money(raw.appraisal),
    bidCount: null,
    marketValue: null,
    costs: {
      commissionRate: commission !== null && Number.isFinite(commission) ? bps(Math.round(commission * 100)) : null,
      dispatcherFee: null,
      removalFee: null,
      storageFee: null,
      inspectionFee: null,
      otherFees: null,
    },
    photoUrls: raw.photos,
    raw,
  };
}

/** Descrição, condição e situação a partir de `raw`. */
export function leiloesFreireDetailsFromRaw(raw: unknown, now: Date): ListingDetails | null {
  const parsed = readLeiloesFreireRaw(raw);
  if (!parsed) return null;
  const endsAt = isoDate(parsed.auctionEndsAt) ?? isoDate(parsed.auctionStartsAt);
  return {
    description: cleanDescription(parsed.description),
    condition: conditionOf(parsed.description),
    status: mapStatus(parsed, endsAt, now),
    sourceStatus: parsed.statusText,
  };
}

export function readLeiloesFreireRaw(raw: unknown): FreireRaw | null {
  const parsed = freireRawSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** "Aguardando Lance" depois do fim do leilão é lote que ninguém arrematou. */
function mapStatus(
  raw: Pick<FreireRaw, "statusCode" | "auctionStatus">,
  endsAt: Date | null,
  now: Date,
): ListingStatus {
  const ended = raw.auctionStatus === AUCTION_CLOSED || (endsAt !== null && endsAt < now);
  if (raw.statusCode === AWAITING_BID) return ended ? "unsold" : "open";
  const known = raw.statusCode === null ? undefined : STATUS_BY_CODE[raw.statusCode];
  if (known) return known;
  return ended ? "unknown" : "open";
}

function conditionOf(description: string): ListingInput["condition"] {
  const notes = parseConditionNotes(description);
  const salvage = /\bSUCATA\b/.test(normalizeNotes(description)) ? "salvage" : null;
  return { ...notes, damageLevel: worstDamage(notes.damageLevel, salvage), inspection: null, inspectionNotes: null };
}

/** O comitente é o órgão do título ("PREFEITURA M. DE ALIANÇA-PE", "DETRAN/AL - EDITAL 003/2026 (MACEIÓ)"). */
function sellerOf(title: string | null): string | null {
  if (title === null) return null;
  return nonEmpty(title.replace(/\s*\((?:\d+ª\s*)?(?:CHAMADA|PRAÇA)[^)]*\)\s*$/i, "").replace(/\s+-\s+EDITAL.*$/i, ""));
}

/**
 * Município e UF do leilão. Leilão de prefeitura: o município do título ("PREFEITURA M. DE ALIANÇA-PE"); Detran: a
 * cidade entre parênteses ("DETRAN/AL - … (ARAPIRACA)"); demais: o fim do "Local do Leilão" ("… - Rio Largo/AL").
 * Sem nada disso, só a UF do título, ou nada (nunca adivinhado).
 */
export function placeOf(title: string | null, place: string | null): ListingInput["location"] {
  const location = (city: string | null, state: string | null): ListingInput["location"] => ({
    yardName: place,
    city: city === null ? null : nonEmpty(city),
    state,
    address: null,
  });
  const name = (title ?? "").toUpperCase();
  const cityHall =
    /PREFEITURA\s+(?:M\.|MUNICIPAL)\s+(?:D[AEO]S?\s+)?(.+?)\s*[-–]\s*([A-Z]{2})\b/.exec(name) ??
    /PREFEITURA\s+(?:M\.|MUNICIPAL)\s+(?:D[AEO]S?\s+)?(.+?)\s+([A-Z]{2})\s*(?:\(|$)/.exec(name);
  const cityHallState = cityHall?.[2] ? stateCode(cityHall[2]) : null;
  if (cityHall?.[1] && cityHallState) return location(cityHall[1], cityHallState);

  const detran = /DETRAN\s*\/\s*([A-Z]{2})\b.*\(([^)]+)\)/.exec(name);
  const detranState = detran?.[1] ? stateCode(detran[1]) : null;
  if (detran?.[2] && detranState) return location(detran[2], detranState);

  const tail = (place ?? "").split(/\s+-\s+/).at(-1) ?? "";
  const placed = /^([\p{L} .'´]+?)\s*\/\s*([A-Za-z]{2})$/u.exec(tail.trim());
  const placedState = placed?.[2] ? stateCode(placed[2]) : null;
  if (placed?.[1] && placedState && !/^(GARAGEM|P[AÁ]TIO|EST[AÁ]DIO|PR[EÉ]DIO|SEDE)\b/i.test(placed[1])) {
    return location(placed[1].replace(/^ZONA RURAL\s+(?:DE\s+)?/i, ""), placedState);
  }
  const titleState = /[-–]\s*([A-Z]{2})\b/.exec(name)?.[1] ?? /\/([A-Z]{2})\b/.exec(name)?.[1];
  const state = (titleState ? stateCode(titleState) : null) ?? (placed?.[2] ? stateCode(placed[2]) : null);
  return location(null, state);
}

export type FreireVehicle = {
  /** Marca e modelo como o lote escreve ("VW/GOL 1.0", "MICRO ÔNIBUS IVECO/CITYCLASS 70C17"). */
  name: string;
  brand: string | null;
  model: string | null;
  manufactureYear: number | null;
  modelYear: number | null;
  color: string | null;
  fuel: string | null;
  category: ListingCategory | null;
};

/**
 * Descrição do lote no formato do registro: "VW/GOL 1.0, ANO/MOD 2009/2009, COR PRATA, COMBUS ALCO/GASOL, PLACA …,
 * RENAVAM …". Alguns leilões abreviam o ano ("ANO/MOD 09/10") e juntam cor e combustível ("COR BRANCA A DIESEL").
 */
export function parseLeiloesFreireDescription(description: string, now: Date): FreireVehicle {
  const text = description.toUpperCase().replace(/\s+/g, " ").trim();
  const name = (text.split(",")[0] ?? "")
    .replace(/\s+(?:DE\s+)?PLACA\b.*$/, "")
    .replace(/\s+NA\s+COR\b.*$/, "")
    .replace(/\.$/, "")
    .trim();
  const years = /\bANO\s*\/\s*MO[DB](?:ELO)?\.?\s*:?\s*(\d{2,4})(?:\s*\/\s*(\d{2,4}))?/.exec(text);
  const salvage = /\bSUCATA\b/.test(normalizeNotes(text));
  const vehicleName = name.replace(VEHICLE_TYPE, "");
  // "FORD CARGO 1719 BS/COMPACTAD": a barra é da carroceria; com espaço antes dela, a marca é a primeira palavra.
  const beforeSlash = vehicleName.split("/")[0] ?? "";
  const bodySlash = beforeSlash.includes(" ") && splitByKnownBrand(beforeSlash).brand !== null;
  const split =
    vehicleName.includes("/") && !bodySlash ? splitDetranVehicle(vehicleName) : splitByKnownBrand(vehicleName);
  return {
    name,
    ...split,
    manufactureYear: toYear(years?.[1], now),
    modelYear: toYear(years?.[2] ?? years?.[1], now),
    color: nonEmpty(/\bCOR\s+([\p{L}]+(?:\s+(?!A\b|AL|COMBUS)[\p{L}]+)?)/u.exec(text)?.[1] ?? ""),
    fuel: fuelOf(text),
    category: categoryOf(name, split, salvage),
  };
}

/** Sem barra ("CAMINHÃO FORD CARGO 1719"): a marca é a primeira palavra, se for uma marca conhecida. */
function splitByKnownBrand(name: string): { brand: string | null; model: string | null } {
  const [first = "", ...rest] = name.split(" ");
  return isKnownVehicleBrand(first) ? { brand: first, model: nonEmpty(rest.join(" ")) } : { brand: null, model: null };
}

function categoryOf(
  name: string,
  split: { brand: string | null; model: string | null },
  salvage: boolean,
): ListingCategory | null {
  if (salvage) return "Sucatas";
  if (HEAVY_TYPE.test(name)) return "Pesados";
  if (MOTO_TYPE.test(name)) return "Motos";
  return categoryOfVehicle(split.brand, split.model);
}

/** "COMBUS ALCO/GASOL", "COMBUSTIVEL GASOLINA" ou "COR BRANCA A DIESEL". */
function fuelOf(text: string): string | null {
  const labeled = /\bCOMBUS(?:TIVEL|T)?\.?\s*:?\s*([^,.]+)/.exec(text)?.[1];
  const after = /\bCOR\s+[\p{L}]+\s+A\s*([A-Z/]+)/u.exec(text)?.[1];
  return nonEmpty(labeled ?? after ?? "");
}

/** "2009" ou "09" (dois dígitos: 20xx até o ano que vem, senão 19xx). */
function toYear(value: string | undefined, now: Date): number | null {
  if (value === undefined) return null;
  const next = now.getUTCFullYear() + 1;
  const year = value.length === 2 ? 2000 + Number(value) : Number(value);
  const fixed = value.length === 2 && year > next ? year - 100 : year;
  return fixed >= 1900 && fixed <= next ? fixed : null;
}

function isoDate(value: string | null): Date | null {
  if (value === null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function moneyText(value: number | string | null): string | null {
  if (value === null) return null;
  const text = String(value).trim();
  return /^\d+(?:\.\d+)?$/.test(text) && Number(text) > 0 ? text : null;
}

function money(text: string | null): Cents | null {
  if (text === null) return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? reaisToCents(value) : null;
}

function plain(html: string): string {
  return decodeHtmlEntities(decodeHtmlEntities(html).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function nonEmpty(text: string): string | null {
  return text.trim() === "" ? null : text.trim();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value !== ""))];
}
