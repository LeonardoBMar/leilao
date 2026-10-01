import {
  cleanDescription,
  type ListingCondition,
  normalizeNotes,
  parseConditionNotes,
} from "@/domain/listings/condition";
import { normalizePlaceName } from "@/domain/listings/place";
import type { ListingCategory, ListingInput, ListingStatus } from "@/domain/listings/types";
import { bps, type Cents, parseBRL } from "@/domain/money";
import { formatDate } from "@/lib/format";
import { err, ok, type Result } from "@/lib/result";

import { PATIO_IMAGE_ORIGIN } from "../image-origins";
import { htmlToLines } from "../shared/extract";
import type { DiscoveredListing, ListingDetails, ParseError } from "../types";
import { type PatioDateParts, type PatioLiveLot, patioLiveLotSchema, patioLiveResponseSchema } from "./schema";

export const PATIO_BASE_URL = "https://patioestadualsc.org";
export const PATIO_NAME = "Pátio Estadual São Carlos";
/** Consulta interna que o site usa para atualizar lance e situação na tela. */
export const PATIO_LIVE_URL = `${PATIO_BASE_URL}/app/Ajax/Leiloes/atualizar_leiloes.php`;

/** O site aceita qualquer texto no lugar do nome do veículo na URL; o id basta. */
export const patioListingUrl = (externalId: string) => `${PATIO_BASE_URL}/lote/-/${externalId}/`;

/** Listas por categoria do site (`/lotes/?cate[]=N`): 1 veículos, 2 motocicletas. Paginação começa em 0. */
export const patioListUrl = (category: number, page: number) =>
  `${PATIO_BASE_URL}/lotes/?cate%5B0%5D=${category}&pag=${page}`;

/**
 * Situações do site, como o próprio site as mostra (`eventos.js`): 2 "Lote Arrematado", 3 "Não Arrematado",
 * 10 "Leilão Condicional". Confirmadas na consulta de 30/09/2026 (fixtures). "Venda direta" (20) não é leilão e fica
 * sem mapa: vira `open` antes do fim e `unknown` depois, como toda situação desconhecida.
 */
const STATUS_BY_SITUACAO: Record<number, ListingStatus> = {
  0: "open",
  1: "open",
  2: "sold",
  3: "unsold",
  10: "conditional",
};

/** Categoria do site → vocabulário comum (D-37). Chaves já normalizadas (`normalizePlaceName`). */
const CATEGORY_BY_NAME: Record<string, ListingCategory> = {
  AUTOMOVEIS: "Carros",
  AUTOMOVEL: "Carros",
  CARROS: "Carros",
  SUV: "Carros",
  HATCH: "Carros",
  SEDAN: "Carros",
  "PICAPES PEQUENAS": "Utilitarios",
  "PICAPES GRANDES": "Utilitarios",
  PICAPES: "Utilitarios",
  UTILITARIOS: "Utilitarios",
  VANS: "Utilitarios",
  MOTOCICLETAS: "Motos",
  MOTOS: "Motos",
  CAMINHOES: "Pesados",
  ONIBUS: "Pesados",
  SUCATAS: "Sucatas",
};
/**
 * Sem "Categoria" na página (ex.: motos), vale o grupo da consulta interna. "Veículos" é o grupo de carros e
 * utilitários; sem como separar, fica em "Carros", que é o que o fluxo de análise cobre.
 */
const CATEGORY_BY_GROUP: Record<string, ListingCategory> = { VEICULOS: "Carros", MOTOCICLETAS: "Motos" };

/** Rótulos da ficha "Informações do bem" (normalizados), que muda de leilão para leilão. */
const FIELD_BY_LABEL: Record<string, InfoField> = {
  MARCA: "brand",
  MODELO: "model",
  VERSAO: "version",
  "ANO MODELO": "modelYear",
  "ANO DO MODELO": "modelYear",
  "ANO DE FABRICACAO": "manufactureYear",
  "ANO FABRICACAO": "manufactureYear",
  KM: "mileage",
  QUILOMETRAGEM: "mileage",
  "VALOR FIPE": "fipe",
  "TABELA FIPE": "fipe",
  FIPE: "fipe",
  CATEGORIA: "category",
  COMBUSTIVEL: "fuel",
  COR: "color",
  CHAVE: "key",
  CHAVES: "key",
  CONDICAO: "recovery",
  "ORIGEM DO LOTE": "recovery",
  PROCEDENCIA: "recovery",
};
type InfoField =
  | "brand"
  | "model"
  | "version"
  | "modelYear"
  | "manufactureYear"
  | "mileage"
  | "fipe"
  | "category"
  | "fuel"
  | "color"
  | "key"
  | "recovery";

/** Endereço do pátio do leiloeiro (rodapé do site). */
const YARD: ListingInput["location"] = {
  yardName: PATIO_NAME,
  city: "São Carlos",
  state: "SP",
  address: "Estr. Mun. Washington José Pêra, 2840, Água Fria",
};

/** Horário de Brasília (o do site): UTC−3, sem horário de verão desde 2019. */
const BRASILIA_OFFSET_HOURS = 3;
/** Página de lote que o site já tirou do ar: responde 200 com este aviso. */
const GONE_MARKER = "Nenhum Lote Encontrado";

/** Lista de lotes de uma categoria: os anúncios da página e o número da última página. */
export function parsePatioLotList(html: string): { listings: DiscoveredListing[]; lastPage: number | null } {
  const found = new Map<string, DiscoveredListing>();
  for (const [, id] of html.matchAll(/href="\/lote\/[^"/]*\/(\d+)\/"/g)) {
    if (id && !found.has(id)) found.set(id, { externalId: id, url: patioListingUrl(id), lastModified: null });
  }
  const last = /href="[^"]*pag=(\d+)"[^>]*aria-label="Última página"/.exec(html)?.[1];
  return { listings: [...found.values()], lastPage: last === undefined ? null : Number(last) };
}

/** Situação de vários lotes na resposta da consulta interna, por id. Lote ausente ou fora do formato fica de fora. */
export function parsePatioLive(json: string): Result<Map<string, PatioLiveLot>, ParseError> {
  const response = patioLiveResponseSchema.safeParse(parseJson(json));
  if (!response.success) return err("invalid_data");
  const lots = new Map<string, PatioLiveLot>();
  for (const [id, value] of Object.entries(response.data.item)) {
    const lot = patioLiveLotSchema.safeParse(value);
    if (lot.success) lots.set(id, lot.data);
  }
  return ok(lots);
}

/** A página diz que o lote não existe mais. */
export function isPatioPageGone(html: string): boolean {
  return html.includes(GONE_MARKER) && !html.includes("lote-page__panel-body--info");
}

/** Dado bruto guardado em `listings.raw`: a ficha, a descrição e a situação, sem quem deu lance. */
type PatioRaw = { info: Record<string, string>; notes: string[]; description: string | null; live: PatioLiveLot };

/** Página do lote + situação da consulta interna → anúncio no formato único. */
export function parsePatioListing(html: string, live: PatioLiveLot, now: Date): Result<ListingInput, ParseError> {
  const infoHtml = sliceBetween(html, "lote-page__panel-body--info", "<h2");
  if (infoHtml === null) return err("missing_data");
  const { info, notes } = readInfo(htmlToLines(infoHtml));
  const descriptionHtml = sliceBetween(html, "lote-page__descricao-texto", "</div>");
  const description = descriptionHtml === null ? null : htmlToLines(descriptionHtml).join("\n");
  const raw: PatioRaw = { info, notes, description, live: sanitizeLive(live) };
  return ok(fromRaw(raw, html, now));
}

/** Descrição, condição e situação a partir de `raw`. */
export function patioDetailsFromRaw(raw: unknown, now: Date): ListingDetails | null {
  const parsed = readRaw(raw);
  if (!parsed) return null;
  const endsAt = brasiliaDate(parsed.live.cronometro.data.fim);
  return {
    description: describe(parsed),
    condition: conditionOf(parsed),
    status: mapStatus(parsed.live.situacao, endsAt, now),
    sourceStatus: String(parsed.live.situacao),
  };
}

function fromRaw(raw: PatioRaw, html: string, now: Date): ListingInput {
  const { info, live } = raw;
  const field = (name: InfoField) => info[name] ?? null;
  const externalId = live.box_id;
  const startsAt = brasiliaDate(live.cronometro.data.ini);
  const endsAt = brasiliaDate(live.cronometro.data.fim);
  const lotNumber = /class="lote-page__title-lote">\s*Lote\s+(\w+)/.exec(html)?.[1] ?? null;
  const commission = /id="lote6ModalComissaoPct">\s*([\d.,]+)\s*</.exec(html)?.[1];

  return {
    externalId,
    url: patioListingUrl(externalId),
    lotNumber,
    title: live.nome.trim(),
    vehicle: {
      brand: field("brand"),
      model: field("model"),
      fipeCode: null,
      fipeName: field("version"),
      modelYear: toYear(field("modelYear")),
      manufactureYear: toYear(field("manufactureYear")),
      mileageKm: toKm(field("mileage")),
      fuel: field("fuel"),
      color: field("color"),
      category: categoryOf(field("category"), live.categorias),
      recoveryType: field("recovery"),
      hasKey: toYesNo(field("key")),
    },
    auction: {
      externalId: live.leiloes,
      // A página do lote não traz o nome do leilão; o dia do fechamento identifica o evento para o usuário.
      name: endsAt === null ? `Leilão ${live.leiloes}` : `Leilão de ${formatDate(endsAt)}`,
      startsAt: null,
    },
    sellerName: null,
    description: describe(raw),
    condition: conditionOf(raw),
    startsAt,
    endsAt,
    location: placeOf(live.local),
    status: mapStatus(live.situacao, endsAt, now),
    sourceStatus: String(live.situacao),
    currentBid: live.count_lances > 0 ? money(live.lance.atual) : null,
    minimumBid: money(live.lance.ini),
    bidCount: live.count_lances,
    marketValue: money(field("fipe")),
    costs: {
      commissionRate: commission === undefined ? null : toBps(commission),
      dispatcherFee: null,
      removalFee: null,
      storageFee: null,
      inspectionFee: null,
      otherFees: null,
    },
    photoUrls: photosOf(html),
    raw,
  };
}

/** Linhas "Rótulo: valor" da ficha. Rótulo conhecido vira campo; o resto (e linhas soltas) vai para as notas. */
function readInfo(lines: readonly string[]): { info: Record<string, string>; notes: string[] } {
  const info: Record<string, string> = {};
  const notes: string[] = [];
  for (const line of lines) {
    // "Tabela FIPE R$ 67.847,00" vem sem dois-pontos.
    const match = /^([^:]{1,40}):\s*(.*)$/.exec(line) ?? /^(Tabela FIPE|Valor FIPE)\s+(R\$.*)$/i.exec(line);
    const label = match?.[1] ? normalizePlaceName(match[1].replace(/\.$/, "")) : null;
    const name = label === null ? undefined : FIELD_BY_LABEL[label];
    const value = match?.[2]?.trim() ?? "";
    // Campo conhecido em branco ("KM: -") não diz nada: nem campo, nem nota.
    if (name && (value === "" || value === "-")) continue;
    if (name && info[name] === undefined) info[name] = value;
    else notes.push(line);
  }
  return { info, notes };
}

function describe(raw: Pick<PatioRaw, "notes" | "description">): string | null {
  return cleanDescription([...raw.notes, raw.description ?? ""].join("\n"));
}

/** Condição declarada: a mesma leitura de texto do Leilo, sobre a ficha inteira e a descrição. Sem laudo cautelar. */
function conditionOf(raw: PatioRaw): ListingCondition {
  const text = [...Object.values(raw.info), ...raw.notes, raw.description ?? ""].join("\n");
  return { ...parseConditionNotes(text), inspection: null, inspectionNotes: null };
}

function categoryOf(name: string | null, group: string | null | undefined): ListingCategory | null {
  const byName = name === null ? undefined : CATEGORY_BY_NAME[normalizePlaceName(name)];
  return byName ?? (group ? (CATEGORY_BY_GROUP[normalizePlaceName(group)] ?? null) : null);
}

function mapStatus(situacao: number, endsAt: Date | null, now: Date): ListingStatus {
  const known = STATUS_BY_SITUACAO[situacao];
  if (known) return known;
  return endsAt !== null && endsAt < now ? "unknown" : "open";
}

/** "Curitiba, PR" → cidade e UF; vazio (", ") → pátio do leiloeiro; cidade cortada ("Aparecida de G..., PR") → só a UF. */
function placeOf(local: string | null | undefined): ListingInput["location"] {
  const unknown = { yardName: null, city: null, state: null, address: null };
  // Sem local na consulta, o lote está no pátio do leiloeiro, em São Carlos.
  if ((local ?? "").replace(/[\s,]/g, "") === "") return YARD;
  const match = /^\s*([^,]*?)\s*,\s*([A-Za-z]{2})\s*$/.exec(local ?? "");
  if (!match?.[2]) return unknown;
  const state = match[2].toUpperCase();
  // Cidade cortada pelo site: só a UF é confiável (nunca o pátio, que poria o lote na região errada).
  const city = match[1] && !match[1].endsWith("...") ? match[1] : null;
  return { ...unknown, city, state };
}

function photosOf(html: string): string[] {
  const gallery = sliceBetween(html, "Galeria_Produtos_Img_Maior", "lote-page__gallery-arrow--next") ?? "";
  const paths = [...gallery.matchAll(/src="(\/web\/fotos\/[^"]+)"/g)].flatMap(([, path]) => (path ? [path] : []));
  return [...new Set(paths)].filter((path) => !path.includes("/thumbs/")).map((path) => `${PATIO_IMAGE_ORIGIN}${path}`);
}

/**
 * Só os campos usados da consulta, um a um: um campo novo do site (ex.: quem deu lance) nunca chega a `raw` sem
 * passar por aqui. Fica de fora o que muda a cada acesso (cronômetros, visualizações).
 */
function sanitizeLive(live: PatioLiveLot): PatioLiveLot {
  return {
    box_id: live.box_id,
    nome: live.nome,
    situacao: live.situacao,
    count_lances: live.count_lances,
    leiloes: live.leiloes,
    local: live.local ?? null,
    categorias: live.categorias ?? null,
    lance: { ini: live.lance.ini ?? null, atual: live.lance.atual ?? null },
    cronometro: { data: live.cronometro.data },
  };
}

function readRaw(raw: unknown): PatioRaw | null {
  if (!isRecord(raw) || !isRecord(raw.info) || !Array.isArray(raw.notes)) return null;
  const live = patioLiveLotSchema.safeParse(raw.live);
  if (!live.success) return null;
  const info = Object.fromEntries(
    Object.entries(raw.info).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : [])),
  );
  const notes = raw.notes.filter((note): note is string => typeof note === "string");
  const description = typeof raw.description === "string" ? raw.description : null;
  return { info, notes, description, live: live.data };
}

function brasiliaDate(parts: PatioDateParts): Date | null {
  const year = Number(parts.ano);
  const month = Number(parts.mes);
  const day = Number(parts.dia);
  const hour = Number(parts.hora);
  const minute = Number(parts.min);
  const second = Number(parts.seg);
  if (![year, month, day, hour, minute, second].every(Number.isInteger) || year < 2000) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour + BRASILIA_OFFSET_HOURS, minute, second));
  return Number.isNaN(date.getTime()) ? null : date;
}

function money(text: string | null | undefined): Cents | null {
  const cleaned = text?.replace(/[^\d.,-]/g, "") ?? "";
  if (cleaned === "") return null;
  const value = parseBRL(cleaned);
  return value !== null && value > 0 ? value : null;
}

function toBps(percent: string) {
  const value = Number(percent.replace(",", "."));
  return Number.isFinite(value) && value >= 0 && value <= 100 ? bps(Math.round(value * 100)) : null;
}

function toYear(value: string | null): number | null {
  const year = Number(value?.match(/\d{4}/)?.[0]);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
}

function toKm(value: string | null): number | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits === "" ? null : Number(digits);
}

function toYesNo(value: string | null): boolean | null {
  const normalized = normalizeNotes(value ?? "");
  if (normalized.startsWith("SIM")) return true;
  if (normalized.startsWith("NAO")) return false;
  return null;
}

/** Conteúdo depois da tag que contém `start` (ex.: uma classe), até o `end` seguinte. */
function sliceBetween(html: string, start: string, end: string): string | null {
  const at = html.indexOf(start);
  if (at < 0) return null;
  const from = html.indexOf(">", at) + 1;
  const to = html.indexOf(end, from);
  return html.slice(from, to < 0 ? undefined : to);
}

function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
