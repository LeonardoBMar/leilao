import { cleanDescription, normalizeNotes, parseConditionNotes, worstDamage } from "@/domain/listings/condition";
import { normalizePlaceName, splitBrandModel, stateCode } from "@/domain/listings/place";
import type { ListingCategory, ListingInput, ListingStatus } from "@/domain/listings/types";
import { bps, type Cents, sumCents } from "@/domain/money";

import { SUPORTE_LEILOES_IMAGE_ORIGIN } from "../image-origins";
import { decodeHtmlEntities, extractAssignedJson, htmlToLines, reaisToCents } from "../shared/extract";
import { redactVehicleIds } from "../shared/redact";
import { categoryOfVehicle } from "../shared/vehicle-category";
import type { ListingDetails } from "../types";
import { type LeiloesPbPageLot, leiloesPbPageLotSchema, type LeiloesPbRaw, leiloesPbRawSchema } from "./schema";

export const LEILOES_PB_BASE_URL = "https://www.leiloespb.com.br";
export const LEILOES_PB_NAME = "Leilões PB";

/** Página inicial: lista os eventos (leilões) com lotes abertos. */
export const LEILOES_PB_HOME_URL = `${LEILOES_PB_BASE_URL}/`;

/**
 * Anúncio = lote, pelo id do site. O endereço do site é `/eventos/leilao/{slug do leilão}/lote/{id}/{slug do lote}`,
 * mas os dois slugs podem ser qualquer texto: a página só depende do id.
 */
export const leiloesPbListingUrl = (lotId: string) => `${LEILOES_PB_BASE_URL}/eventos/leilao/leilao/lote/${lotId}/lote`;

/** Página `page` da lista de lotes do evento (48 por página); o slug do evento também pode ser qualquer texto. */
export const leiloesPbAuctionUrl = (auctionId: string, page: number) =>
  `${LEILOES_PB_BASE_URL}/eventos/leilao/${auctionId}/leilao?page=${page}`;

/** Fotos do lote: só as da pasta de bens deste site, no servidor de arquivos da plataforma Suporte Leilões. */
const PHOTO_PREFIX = `${SUPORTE_LEILOES_IMAGE_ORIGIN}/leiloespbcombr/bens/`;

/**
 * Situação do lote (`status` do JSON), com o nome que o site mostra nos cartões do evento, conferida em ~1.000 lotes
 * de 40 eventos em 11/10/2026. "Homologando" e "Baixa oferta" (lance abaixo do mínimo) esperam o comitente; "Cancelado"
 * é arremate desfeito. O resto não é adivinhado.
 */
const STATUS_BY_CODE: Record<number, { status: ListingStatus; label: string }> = {
  1: { status: "open", label: "Aberto para Lances" },
  5: { status: "conditional", label: "Homologando" },
  8: { status: "unsold", label: "Sem Licitantes" },
  9: { status: "conditional", label: "Baixa Oferta" },
  10: { status: "withdrawn", label: "Retirado" },
  11: { status: "withdrawn", label: "Cancelado" },
  100: { status: "sold", label: "Vendido" },
};

/**
 * Subcategorias de veículo dos cartões do evento, vistas nos eventos de 09-10/2026. "Outros" (do menu "Veículos") fica
 * de fora: o único lote visto era uma retroescavadeira de leilão judicial.
 */
const VEHICLE_SUBCATEGORIES = new Set(["CARROS", "UTILITARIO", "MOTOS", "PESADOS", "PICKUP"]);

/** Fuso do site (`America/Fortaleza`, `America/Sao_Paulo`): UTC−3, sem horário de verão desde 2019. */
const UTC_MINUS_3_ZONES = new Set(["America/Fortaleza", "America/Sao_Paulo", "America/Recife", "America/Bahia"]);

/**
 * Ids dos eventos listados na página inicial, na ordem do site, sem repetir. `null`: a página não tem a seção de
 * eventos (o site mudou), nunca "nenhum evento" sem conferir.
 */
export function parseLeiloesPbHome(html: string): string[] | null {
  if (!/<section[^>]*id="eventos"/.test(html)) return null;
  return unique([...html.matchAll(/href="\/eventos\/leilao\/(\d+)\//g)].map(([, id]) => id ?? ""));
}

export type LeiloesPbAuctionPage = {
  /** Lotes de veículo da página (pela subcategoria do cartão); imóveis e bens diversos ficam de fora. */
  lotIds: string[];
  /** Maior página citada na paginação. */
  lastPage: number;
};

/** Página da lista de lotes de um evento. `null`: não é a página deste evento. */
export function parseLeiloesPbAuctionPage(html: string, auctionId: string): LeiloesPbAuctionPage | null {
  if (!html.includes(`#/auditorio/${auctionId}"`)) return null;
  const lotIds: string[] = [];
  for (const card of html.split('<article class="lote-main').slice(1)) {
    const lotId = /\/lote\/(\d+)\//.exec(card)?.[1];
    const subcategory = normalizePlaceName(plain(/<h3>([^<]*)<\/h3>/.exec(card)?.[1] ?? ""));
    if (lotId && VEHICLE_SUBCATEGORIES.has(subcategory)) lotIds.push(lotId);
  }
  const pages = [...html.matchAll(/href="\?page=(\d+)"/g)].map(([, page]) => Number(page));
  return { lotIds: unique(lotIds), lastPage: Math.max(1, ...pages) };
}

/** Lê a página do lote. `null`: falta o `var lote` ou ele está fora do formato (o site mudou). */
export function parseLeiloesPbLotPage(html: string): LeiloesPbRaw | null {
  const parsed = leiloesPbPageLotSchema.safeParse(extractAssignedJson(html, "var lote ="));
  if (!parsed.success) return null;
  const lot = parsed.data;
  return {
    lotId: String(lot.id),
    auctionId: String(lot.leilao.id),
    auctionCode: nonEmpty(lot.leilao.codigo ?? ""),
    auctionTitle: nonEmpty(plain(lot.leilao.titulo ?? "")),
    auctionStartsAt: lot.leilao.data1,
    lotNumber: lot.numero === null ? null : String(lot.numero),
    // Placa, chassi e Renavam saem já aqui (título e descrição): nem o `raw` os guarda (D-40).
    title: redactVehicleIds(plain(lot.descricao ?? "")),
    description: descriptionOf(html),
    seller: nonEmpty(plain(/<strong>Comitente<\/strong>\s*<p>([^<]*)<\/p>/.exec(html)?.[1] ?? "")),
    statusCode: lot.status,
    closedAt: lot.dataFechamento,
    finalBid: moneyText(lot.valorArremate),
    currentBid: moneyText(lot.valorLanceAtual),
    bidCount: lot.totalLances,
    minimumBid: moneyText(lot.valorInicial),
    marketValue: moneyText(lot.valorMercado),
    ...feesOf(lot),
    photos: photosOf(html),
  };
}

/**
 * Linhas do bloco "Descrição", sem a primeira ("HDI | LOTE: 1 | DATA: 09/10/2026", que repete comitente, número e
 * data). O número do sinistro ("Sinistro: COLISÃO (010393155614248)") é da seguradora e sai.
 */
function descriptionOf(html: string): string[] {
  const block = /<h6>Descri(?:ç|&ccedil;)(?:ã|&atilde;)o<\/h6>\s*<p>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
  return htmlToLines(block)
    .filter((line) => !/^\S.*\|\s*LOTE:\s*\d+/i.test(line))
    .map((line) => redactVehicleIds(line.replace(/^(SINISTRO:\s*[^(]*?)\s*\(\d+\)/i, "$1")));
}

/** Comissão (taxa em %) e taxas fixas (valor em reais) que a página calcula para o lote. */
function feesOf(lot: LeiloesPbPageLot): Pick<LeiloesPbRaw, "commissionPercent" | "fixedFees"> {
  const fees = lot.taxasCalculadas ?? [];
  const commission = fees.find(
    (fee) => fee.imposto.tipo === 1 && /COMISS/i.test(normalizeNotes(fee.imposto.nome ?? "")),
  );
  return {
    commissionPercent: commission ? moneyText(commission.imposto.valor) : null,
    fixedFees: fees
      .filter((fee) => fee.imposto.tipo === 2)
      .map((fee) => moneyText(fee.valor))
      .filter((value) => value !== null),
  };
}

/** Fotos da galeria do lote, na ordem do site, sem repetir. */
function photosOf(html: string): string[] {
  const pattern = new RegExp(`(?:src|href)="(${escapeRegExp(PHOTO_PREFIX)}[^"]+)"`, "g");
  return unique([...html.matchAll(pattern)].map(([, url]) => decodeHtmlEntities(url ?? "")));
}

/** Dado bruto → anúncio no formato único. */
export function buildLeiloesPbListing(raw: LeiloesPbRaw, now: Date): ListingInput {
  const vehicle = parseLeiloesPbTitle(raw.title, now);
  const auctionAt = siteDate(raw.auctionStartsAt);
  const status = mapStatus(raw.statusCode, auctionAt, now);
  const bidCount = raw.bidCount ?? 0;
  const bid = money(raw.finalBid) ?? money(raw.currentBid);
  const fees = raw.fixedFees.map(money).filter((fee) => fee !== null);
  const commission = raw.commissionPercent === null ? null : Number(raw.commissionPercent);

  return {
    externalId: raw.lotId,
    url: leiloesPbListingUrl(raw.lotId),
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
      color: colorOf(raw.description),
      category: categoryOf(vehicle),
      recoveryType: null,
      hasKey: keyOf(raw.description),
    },
    auction: {
      externalId: raw.auctionId,
      name: raw.auctionTitle ?? `Leilão ${raw.auctionCode ?? raw.auctionId}`,
      startsAt: auctionAt,
    },
    sellerName: raw.seller,
    description: describe(raw),
    condition: conditionOf(raw),
    startsAt: null,
    // Os lotes são apregoados em sequência a partir da hora do leilão; a página só diz quando cada um fechou.
    endsAt: siteDate(raw.closedAt) ?? auctionAt,
    location: placeOf(raw.description),
    status,
    sourceStatus: statusLabel(raw.statusCode),
    currentBid: bidCount === 0 ? null : bid,
    minimumBid: money(raw.minimumBid),
    bidCount,
    marketValue: money(raw.marketValue),
    costs: {
      commissionRate: commission !== null && Number.isFinite(commission) ? bps(Math.round(commission * 100)) : null,
      dispatcherFee: null,
      removalFee: null,
      storageFee: null,
      inspectionFee: null,
      otherFees: fees.length === 0 ? null : sumCents(fees),
    },
    photoUrls: raw.photos,
    raw,
  };
}

/** Descrição, condição e situação a partir de `raw`. */
export function leiloesPbDetailsFromRaw(raw: unknown, now: Date): ListingDetails | null {
  const parsed = readLeiloesPbRaw(raw);
  if (!parsed) return null;
  return {
    description: describe(parsed),
    condition: conditionOf(parsed),
    status: mapStatus(parsed.statusCode, siteDate(parsed.auctionStartsAt), now),
    sourceStatus: statusLabel(parsed.statusCode),
  };
}

export function readLeiloesPbRaw(raw: unknown): LeiloesPbRaw | null {
  const parsed = leiloesPbRawSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function mapStatus(code: number | null, auctionAt: Date | null, now: Date): ListingStatus {
  const known = code === null ? undefined : STATUS_BY_CODE[code];
  if (known) return known.status;
  return auctionAt !== null && auctionAt < now ? "unknown" : "open";
}

function statusLabel(code: number | null): string | null {
  if (code === null) return null;
  return STATUS_BY_CODE[code]?.label ?? `Situação ${code}`;
}

/** As linhas da descrição; a segunda já repete o título com a cor, então o título só entra quando ela falta. */
function describe(raw: Pick<LeiloesPbRaw, "title" | "description">): string | null {
  return cleanDescription(raw.description.length > 0 ? raw.description.join("\n") : raw.title);
}

/** Monta e sucata do título e das linhas "Monta:" e "Sinistro:" ("(SUCATA) …", "Monta: MEDIA MONTA"). */
function conditionOf(raw: Pick<LeiloesPbRaw, "title" | "description">): ListingInput["condition"] {
  const notes = parseConditionNotes(describe(raw));
  const salvage = isSalvage(raw.title) ? "salvage" : null;
  return { ...notes, damageLevel: worstDamage(notes.damageLevel, salvage), inspection: null, inspectionNotes: null };
}

/**
 * "Patio: LEILÕES PB - PATIO (BAYEUX)" ou "Patio: LEILÕES PB- PATIO ( FEIRA DE SANTANA - BA)". O edital cita pátios em
 * Bayeux/PB e no Distrito Federal: sem a linha, o local fica desconhecido (nunca adivinhado).
 */
function placeOf(description: readonly string[]): ListingInput["location"] {
  const yard = description.map((line) => /^P[AÁ]TIO:\s*(.+)$/i.exec(line)?.[1]?.trim()).find(Boolean) ?? null;
  const inside = plain(/\(([^)]*)\)/.exec(yard ?? "")?.[1] ?? "");
  const withState = /^(.+?)\s*[-/]\s*([A-Za-z]{2})$/.exec(inside);
  const state = withState?.[2] ? stateCode(withState[2]) : null;
  const place =
    withState?.[1] && state
      ? { city: withState[1].trim(), state }
      : normalizePlaceName(inside) === "BAYEUX"
        ? { city: inside, state: "PB" }
        : { city: null, state: null };
  return { yardName: yard === null ? null : plain(yard), ...place, address: null };
}

/** "RENAULT / KWID … 2022/2023 - PRETO": a cor depois do hífen na linha do veículo. */
function colorOf(description: readonly string[]): string | null {
  for (const line of description) {
    const color = /\d{4}\/\d{4}\s+-\s+([\p{L} ]+)$/u.exec(line)?.[1] ?? /\s-\s([\p{L}]+)$/u.exec(line)?.[1];
    if (color && !line.includes(":")) return nonEmpty(color);
  }
  return null;
}

function keyOf(description: readonly string[]): boolean | null {
  const text = normalizeNotes(description.join(" "));
  const answer = /POSSUI CHAVE:\s*(SIM|NAO)\b/.exec(text)?.[1];
  return answer === undefined ? null : answer === "SIM";
}

function categoryOf(vehicle: LeiloesPbVehicle): ListingCategory | null {
  if (vehicle.salvage) return "Sucatas";
  return categoryOfVehicle(vehicle.brand, vehicle.model);
}

export type LeiloesPbVehicle = {
  /** Título sem "(SUCATA)" e sem os anos ("FIAT / STRADA WORKING 1.4 MPI FIRE 8V CS FLEX"). */
  name: string;
  brand: string | null;
  model: string | null;
  manufactureYear: number | null;
  modelYear: number | null;
  fuel: string | null;
  salvage: boolean;
};

const FUEL = /\b(FLEX|DIESEL|DIES\.|GASOLINA|ALCOOL|ETANOL|HIBRIDO|ELETRICO)(?=\s|$)/g;

/**
 * Título do lote: "MARCA / MODELO VERSÃO COMBUSTÍVEL fab/modelo", às vezes com "(SUCATA)" na frente, o ano repetido
 * ("PALIO ATTRACTIVE 2012/2012 2012/2012") ou sem ano ("SAVEIRO TRENDLINE 1.6 TOTAL FLEX 8V").
 */
export function parseLeiloesPbTitle(title: string, now: Date): LeiloesPbVehicle {
  const salvage = isSalvage(title);
  const years = [...title.matchAll(/\b(\d{4})\/(\d{4})\b/g)].at(-1);
  const name = title
    .replace(/\(SUCATA\)/gi, " ")
    .replace(/\b\d{4}\/\d{4}\b/g, " ")
    .replace(/\s*\/\s*/, " / ")
    .replace(/\s+/g, " ")
    .trim();
  const split = splitBrandModel(name);
  const brand = split.brand === null ? null : split.brand.toUpperCase();
  const fuels = [...normalizeNotes(name).matchAll(FUEL)].map(([fuel]) => fuel);
  const fuel = fuels.at(-1);
  return {
    name,
    brand: nonEmpty(brand ?? ""),
    model: split.brand === null ? null : split.model,
    manufactureYear: toYear(years?.[1], now),
    modelYear: toYear(years?.[2], now),
    fuel: fuel === undefined ? null : fuel === "DIES." ? "DIESEL" : fuel,
    salvage,
  };
}

function isSalvage(title: string): boolean {
  return /\(SUCATA\)/i.test(title);
}

function toYear(value: string | undefined, now: Date): number | null {
  if (value === undefined) return null;
  const year = Number(value);
  return year >= 1900 && year <= now.getUTCFullYear() + 1 ? year : null;
}

/** "2026-10-02 14:27:59.000000" no fuso informado → instante UTC. Fuso desconhecido: `null` (nunca adivinhado). */
function siteDate(value: { date: string; timezone: string } | null): Date | null {
  if (value === null || !UTC_MINUS_3_ZONES.has(value.timezone)) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(value.date);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (year === undefined || month === undefined || day === undefined || hour === undefined) return null;
  const result = new Date(Date.UTC(year, month - 1, day, hour + 3, minute ?? 0, second ?? 0));
  return Number.isNaN(result.getTime()) ? null : result;
}

/** Reais em número (24800) ou texto ("24800.00") → texto, para o `raw`; zero e vazio são `null`. */
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
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function nonEmpty(text: string): string | null {
  return text.trim() === "" ? null : text.trim();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value !== ""))];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
