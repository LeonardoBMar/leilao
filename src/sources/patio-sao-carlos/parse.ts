import {
  cleanDescription,
  type ListingCondition,
  normalizeNotes,
  parseConditionNotes,
} from "@/domain/listings/condition";
import { normalizePlaceName, stateCode } from "@/domain/listings/place";
import type { ListingCategory, ListingInput, ListingStatus } from "@/domain/listings/types";
import { bps, type Cents, cents, parseBRL } from "@/domain/money";
import { formatDate } from "@/lib/format";
import { err, ok, type Result } from "@/lib/result";

import { PATIO_IMAGE_ORIGIN } from "../image-origins";
import { brasiliaDateUtc, decodeHtmlEntities, extractNextFlightJson, htmlToLines } from "../shared/extract";
import { redactVehicleIds } from "../shared/redact";
import type { ListingDetails, ParseError } from "../types";
import {
  type PatioAuction,
  patioAuctionSchema,
  type PatioLegacyDateParts,
  patioLegacyLiveLotSchema,
  type PatioListItem,
  type PatioLot,
  patioLotListSchema,
  patioLotSchema,
} from "./schema";

export const PATIO_BASE_URL = "https://patioestadualsc.org";
export const PATIO_NAME = "Pátio Estadual São Carlos";

/** Comissão fixa do leiloeiro (5%), confirmada no edital e no `ModalConfirmarLance` do site. */
const PATIO_COMMISSION_BPS = bps(500);

export const patioListingUrl = (externalId: string) => `${PATIO_BASE_URL}/lote/${externalId}/`;

/** Listas por categoria (`/lotes/?categoriaId=N&pagina=P`): 1 veículos, 2 motocicletas. Paginação começa em 1. */
export const patioListUrl = (category: number, page: number) =>
  `${PATIO_BASE_URL}/lotes/?categoriaId=${category}&pagina=${page}`;

/** Edital do lote: é onde o site informa o endereço real do pátio para visitação. */
export const patioEditalUrl = (externalId: string) =>
  `${PATIO_BASE_URL}/painel-api/v1/publico/edital?lote=${externalId}`;

/** Situações legadas (`atualizar_leiloes.php`), usadas apenas para `detailsFromRaw` em `raw` antigo. */
const LEGACY_STATUS_BY_SITUACAO: Record<number, ListingStatus> = {
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
const CATEGORY_BY_GROUP: Record<string, ListingCategory> = { VEICULOS: "Carros", MOTOCICLETAS: "Motos" };

/** Rótulos da ficha na descrição do lote (normalizados). */
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

/** Lista de lotes de uma categoria extraída do `initialLotes` embutido no HTML Next.js. */
export function parsePatioLotList(html: string): Result<{ items: PatioListItem[]; totalPages: number }, ParseError> {
  const raw = extractNextFlightJson(html, "initialLotes");
  if (raw === null) return err("missing_data");
  const parsed = patioLotListSchema.safeParse(raw);
  if (!parsed.success) return err("invalid_data");
  const { itens, porPagina, total } = parsed.data;
  const totalPages = Math.max(1, Math.ceil(total / porPagina));
  return ok({ items: itens, totalPages });
}

/** "Endereço Pátio: Estr. ..., 2840, ÁGUA FRIA, São Carlos, SÃO PAULO, 13575-675" do edital. */
export function parsePatioEditalAddress(html: string): string | null {
  const match = /Endere(?:ço|&ccedil;o) P(?:á|&aacute;)tio:\s*<\/strong>\s*([^<]+)</i.exec(html);
  const address = match?.[1] ? decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim() : "";
  return address === "" ? null : address;
}

/** Dado bruto guardado em `listings.raw` (sem `metadados` de placa/chassi/Renavam e sem quem deu lance). */
type PatioRaw = {
  info: Record<string, string>;
  notes: string[];
  description: string | null;
  lote: SanitizedPatioLot;
  leilao: SanitizedPatioAuction | null;
  yardAddress: string | null;
};

type SanitizedPatioLot = {
  id: string;
  titulo: string;
  auctionId: string;
  numero: number | null;
  categoria: string | null;
  status: string;
  lanceAtualCentavos: number | null;
  lanceInicialCentavos: number | null;
  valorFipeCentavos: number | null;
  qtdLances: number;
  aberturaIso: string | null;
  fechamentoIso: string | null;
};

type SanitizedPatioAuction = {
  id: string;
  titulo: string | null;
  comitente: string | null;
  aberturaIso: string | null;
  fechamentoIso: string | null;
  taxaAdministrativa: string | null;
  outrosCustos: string | null;
};

/**
 * Reaproveita o endereço do pátio já coletado no `raw` da visita anterior para o mesmo lote, evitando uma nova
 * requisição ao edital a cada revisita.
 */
export function storedYardAddressFor(stored: unknown, externalId: string): string | null {
  if (!isRecord(stored) || typeof stored.yardAddress !== "string" || stored.yardAddress === "") return null;
  if (isRecord(stored.lote) && String(stored.lote.id) === externalId) return stored.yardAddress;
  if (isRecord(stored.live) && String(stored.live.box_id) === externalId) return stored.yardAddress;
  return null;
}

/**
 * Página do lote (`/lote/{id}/`) + endereço do edital → anúncio no formato único.
 * `cidade`/`uf` do `initialLote` não são usados: continuam sendo o local de origem do comitente, não o pátio.
 */
export function parsePatioListing(
  html: string,
  yardAddress: string | null,
  now: Date,
): Result<ListingInput, ParseError> {
  const rawLote = extractNextFlightJson(html, "initialLote");
  if (rawLote === null) return err("missing_data");
  const parsedLote = patioLotSchema.safeParse(rawLote);
  if (!parsedLote.success) return err("invalid_data");

  const rawLeilao = extractNextFlightJson(html, "initialLeilao");
  const parsedLeilao = rawLeilao === null ? null : patioAuctionSchema.safeParse(rawLeilao);
  const leilao = parsedLeilao?.success ? sanitizeAuction(parsedLeilao.data) : null;

  const lote = parsedLote.data;
  const { info, notes } = readInfo(htmlToLines(lote.descricao ?? ""));
  const redactedInfo = Object.fromEntries(Object.entries(info).map(([key, value]) => [key, redactVehicleIds(value)]));
  const redactedNotes = notes.map(redactVehicleIds);
  const extraText = lote.condicoesVenda ? htmlToLines(lote.condicoesVenda).join("\n") : null;
  const description = extraText && extraText !== "" ? redactVehicleIds(extraText) : null;

  const raw: PatioRaw = {
    info: redactedInfo,
    notes: redactedNotes,
    description,
    lote: sanitizeLot(lote),
    leilao,
    yardAddress,
  };

  return ok(fromRaw(raw, photosOf(lote), now));
}

/** Descrição, condição e situação a partir de `raw` (suporta formato novo e legado para `db:reparse`). */
export function patioDetailsFromRaw(raw: unknown, now: Date): ListingDetails | null {
  const current = readRaw(raw);
  if (current) {
    const endsAt = parseIsoDate(current.lote.fechamentoIso);
    return {
      description: describe(current),
      condition: conditionOf(current),
      status: mapStatus(current.lote.status, current.lote.qtdLances, endsAt, now),
      sourceStatus: current.lote.status,
    };
  }
  return legacyDetailsFromRaw(raw, now);
}

function fromRaw(raw: PatioRaw, photoUrls: string[], now: Date): ListingInput {
  const { info, lote, leilao } = raw;
  const field = (name: InfoField) => info[name] ?? null;
  const externalId = lote.id;
  const startsAt = parseIsoDate(lote.aberturaIso);
  const endsAt = parseIsoDate(lote.fechamentoIso);
  const auctionTitle = leilao?.titulo?.trim() ?? "";

  return {
    externalId,
    url: patioListingUrl(externalId),
    lotNumber: lote.numero === null ? null : String(lote.numero),
    title: lote.titulo.trim(),
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
      category: categoryOf(field("category"), lote.categoria),
      recoveryType: field("recovery"),
      hasKey: toYesNo(field("key")),
    },
    auction: {
      externalId: lote.auctionId,
      name:
        auctionTitle !== ""
          ? auctionTitle
          : endsAt === null
            ? `Leilão ${lote.auctionId}`
            : `Leilão de ${formatDate(endsAt)}`,
      startsAt: parseIsoDate(leilao?.aberturaIso ?? null),
    },
    sellerName: leilao?.comitente?.trim() || null,
    description: describe(raw),
    condition: conditionOf(raw),
    startsAt,
    endsAt,
    location: placeOf(raw.yardAddress),
    status: mapStatus(lote.status, lote.qtdLances, endsAt, now),
    sourceStatus: lote.status,
    currentBid:
      lote.qtdLances > 0 && lote.lanceAtualCentavos !== null && lote.lanceAtualCentavos > 0
        ? cents(lote.lanceAtualCentavos)
        : null,
    minimumBid:
      lote.lanceInicialCentavos !== null && lote.lanceInicialCentavos > 0 ? cents(lote.lanceInicialCentavos) : null,
    bidCount: lote.qtdLances,
    marketValue:
      lote.valorFipeCentavos !== null && lote.valorFipeCentavos > 0
        ? cents(lote.valorFipeCentavos)
        : money(field("fipe")),
    costs: {
      commissionRate: PATIO_COMMISSION_BPS,
      dispatcherFee: null,
      removalFee: null,
      storageFee: null,
      inspectionFee: null,
      otherFees: otherFeesOf(leilao),
    },
    photoUrls,
    raw,
  };
}

/**
 * Situações confirmadas no bundle do site (`situacaoLote` e cartão de lote):
 * - `OPEN` → `open`
 * - `CONDITIONAL` → `conditional`
 * - `CLOSED` com `qtdLances > 0` ("Lote Arrematado") → `sold`; sem lances → `unsold`
 * - `DIRECT_SALE` e qualquer outra situação não mapeada → `open` antes do fim e `unknown` depois.
 */
function mapStatus(status: string, bidCount: number, endsAt: Date | null, now: Date): ListingStatus {
  switch (status) {
    case "OPEN":
      return "open";
    case "CONDITIONAL":
      return "conditional";
    case "CLOSED":
      return bidCount > 0 ? "sold" : "unsold";
    default:
      return endsAt !== null && endsAt < now ? "unknown" : "open";
  }
}

/** Linhas "Rótulo: valor" da ficha. Rótulo conhecido vira campo; o resto (e linhas soltas) vai para as notas. */
function readInfo(lines: readonly string[]): { info: Record<string, string>; notes: string[] } {
  const info: Record<string, string> = {};
  const notes: string[] = [];
  for (const line of lines) {
    // "Tabela FIPE R$ 39.984,00" vem sem dois-pontos.
    const match = /^([^:]{1,40}):\s*(.*)$/.exec(line) ?? /^(Tabela FIPE|Valor FIPE)\s+(R\$.*)$/i.exec(line);
    const label = match?.[1] ? normalizePlaceName(match[1].replace(/\.$/, "")) : null;
    const name = label === null ? undefined : FIELD_BY_LABEL[label];
    const value = match?.[2]?.trim() ?? "";
    if (name && (value === "" || value === "-")) continue;
    if (name && info[name] === undefined) info[name] = value;
    else notes.push(line);
  }
  return { info, notes };
}

function describe(raw: Pick<PatioRaw, "notes" | "description">): string | null {
  return cleanDescription(redactVehicleIds([...raw.notes, raw.description ?? ""].join("\n")));
}

function conditionOf(raw: Pick<PatioRaw, "info" | "notes" | "description">): ListingCondition {
  const text = [...Object.values(raw.info), ...raw.notes, raw.description ?? ""].join("\n");
  return { ...parseConditionNotes(text), inspection: null, inspectionNotes: null };
}

function categoryOf(name: string | null, group: string | null | undefined): ListingCategory | null {
  const byName = name === null ? undefined : CATEGORY_BY_NAME[normalizePlaceName(name)];
  return byName ?? (group ? (CATEGORY_BY_GROUP[normalizePlaceName(group)] ?? null) : null);
}

/**
 * Endereço do edital → local. Termina em "cidade, ESTADO POR EXTENSO, CEP"; o resto é logradouro e bairro.
 * Sem edital ou fora desse formato: local desconhecido (sem distância), nunca adivinhado.
 */
function placeOf(address: string | null): ListingInput["location"] {
  const unknown = { yardName: null, city: null, state: null, address: null };
  if (address === null) return unknown;
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  if (/^\d{5}-?\d{3}$/.test(parts.at(-1) ?? "")) parts.pop();
  const state = stateCode(parts.pop() ?? "");
  const city = parts.pop() ?? null;
  if (state === null || city === null) return { ...unknown, address };
  return { yardName: PATIO_NAME, city, state, address: parts.join(", ") || null };
}

function photosOf(lote: PatioLot): string[] {
  const urls = lote.imagens
    .map((image) => image.src.trim())
    .filter((src) => src.startsWith(`${PATIO_IMAGE_ORIGIN}/`) && !src.includes("/thumbs/"));
  return [...new Set(urls)];
}

function otherFeesOf(leilao: SanitizedPatioAuction | null): Cents | null {
  if (!leilao) return null;
  const admin = money(leilao.taxaAdministrativa) ?? 0;
  const other = money(leilao.outrosCustos) ?? 0;
  const total = admin + other;
  return total > 0 ? cents(total) : null;
}

function sanitizeLot(lote: PatioLot): SanitizedPatioLot {
  return {
    id: lote.id,
    titulo: lote.titulo,
    auctionId: lote.auctionId,
    numero: lote.numero ?? null,
    categoria: lote.categoria ?? null,
    status: lote.status,
    lanceAtualCentavos: lote.lanceAtualCentavos ?? null,
    lanceInicialCentavos: lote.lanceInicialCentavos ?? null,
    valorFipeCentavos: lote.valorFipeCentavos ?? null,
    qtdLances: lote.qtdLances,
    aberturaIso: lote.aberturaIso ?? null,
    fechamentoIso: lote.fechamentoIso ?? null,
  };
}

function sanitizeAuction(leilao: PatioAuction): SanitizedPatioAuction {
  return {
    id: leilao.id,
    titulo: leilao.titulo ?? null,
    comitente: leilao.comitente ?? null,
    aberturaIso: leilao.aberturaIso ?? null,
    fechamentoIso: leilao.fechamentoIso ?? null,
    taxaAdministrativa: leilao.taxaAdministrativa == null ? null : String(leilao.taxaAdministrativa),
    outrosCustos: leilao.outrosCustos == null ? null : String(leilao.outrosCustos),
  };
}

function readRaw(raw: unknown): PatioRaw | null {
  if (!isRecord(raw) || !isRecord(raw.info) || !Array.isArray(raw.notes) || !isRecord(raw.lote)) return null;
  const lote = patioLotSchema.safeParse(raw.lote);
  if (!lote.success) return null;
  const leilao = isRecord(raw.leilao) ? patioAuctionSchema.safeParse(raw.leilao) : null;
  const info = Object.fromEntries(
    Object.entries(raw.info).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : [])),
  );
  const notes = raw.notes.filter((note): note is string => typeof note === "string");
  const description = typeof raw.description === "string" ? raw.description : null;
  const yardAddress = typeof raw.yardAddress === "string" ? raw.yardAddress : null;
  return {
    info,
    notes,
    description,
    lote: sanitizeLot(lote.data),
    leilao: leilao?.success ? sanitizeAuction(leilao.data) : null,
    yardAddress,
  };
}

function legacyDetailsFromRaw(raw: unknown, now: Date): ListingDetails | null {
  if (!isRecord(raw) || !isRecord(raw.info) || !Array.isArray(raw.notes)) return null;
  const live = patioLegacyLiveLotSchema.safeParse(raw.live);
  if (!live.success) return null;
  const info = Object.fromEntries(
    Object.entries(raw.info).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : [])),
  );
  const notes = raw.notes.filter((note): note is string => typeof note === "string");
  const description = typeof raw.description === "string" ? raw.description : null;
  const endsAt = legacyBrasiliaDate(live.data.cronometro.data.fim);
  const known = LEGACY_STATUS_BY_SITUACAO[live.data.situacao];
  const status: ListingStatus = known ?? (endsAt !== null && endsAt < now ? "unknown" : "open");
  return {
    description: describe({ notes, description }),
    condition: conditionOf({ info, notes, description }),
    status,
    sourceStatus: String(live.data.situacao),
  };
}

function legacyBrasiliaDate(parts: PatioLegacyDateParts): Date | null {
  const year = Number(parts.ano);
  if (!Number.isInteger(year) || year < 2000) return null;
  return brasiliaDateUtc({
    year,
    month: Number(parts.mes),
    day: Number(parts.dia),
    hour: Number(parts.hora),
    minute: Number(parts.min),
    second: Number(parts.seg),
  });
}

function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function money(text: string | null | undefined): Cents | null {
  const cleaned = text?.replace(/[^\d.,-]/g, "") ?? "";
  if (cleaned === "") return null;
  const value = parseBRL(cleaned);
  return value !== null && value > 0 ? value : null;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
