import {
  cleanDescription,
  type DamageLevel,
  normalizeNotes,
  parseConditionNotes,
  worstDamage,
} from "@/domain/listings/condition";
import { normalizePlaceName, splitBrandModel, stateCode } from "@/domain/listings/place";
import type { ListingCategory, ListingInput, ListingStatus } from "@/domain/listings/types";
import { bps, type Cents, parseBRL } from "@/domain/money";
import { formatDate } from "@/lib/format";

import { FREITAS_IMAGE_ORIGIN } from "../image-origins";
import {
  decodeHtmlEntities,
  htmlToLines,
  htmlToText as plain,
  nonEmpty,
  parseBrasiliaDateTime,
  parseJson,
} from "../shared/extract";
import { redactVehicleIds } from "../shared/redact";
import type { ListingDetails } from "../types";

export const FREITAS_BASE_URL = "https://www.freitasleiloeiro.com.br";
export const FREITAS_NAME = "Freitas Leiloeiro";

/** Anúncio = lote de um leilão: `{leilaoId}-{loteNumero}` (ex.: "8082-2"). */
export const freitasExternalId = (auctionId: string, lotNumber: number) => `${auctionId}-${lotNumber}`;

export function parseFreitasExternalId(externalId: string): { auctionId: string; lotNumber: number } | null {
  const match = /^(\d+)-(\d+)$/.exec(externalId);
  return match?.[1] && match[2] ? { auctionId: match[1], lotNumber: Number(match[2]) } : null;
}

export function freitasListingUrl(externalId: string): string {
  const id = parseFreitasExternalId(externalId);
  return id
    ? `${FREITAS_BASE_URL}/Leiloes/LoteDetalhes?leilaoId=${id.auctionId}&loteNumero=${id.lotNumber}`
    : `${FREITAS_BASE_URL}/Leiloes/LoteDetalhes?${externalId}`;
}

/** Agenda: leilões abertos ou em loteamento, de todos os tipos (imóveis, materiais, veículos). */
export const FREITAS_AGENDA_URL = `${FREITAS_BASE_URL}/Leiloes/ListarLeiloes`;
/** Lotes por pedido na lista do leilão (o site usa 12; aceita mais). */
export const FREITAS_PAGE_SIZE = 100;

/**
 * Filtros da lista de lotes do site (`/Leiloes/ListarLotes`), todos dentro da categoria 1 (veículos). A condição
 * (monta, sucata), o pátio e o tipo do lote só aparecem como filtro: o cartão não diz, e a página do lote sai do ar
 * depois da venda. Por isso a lista é lida também filtrada, e cada lote recebe o que o filtro diz dele.
 */
export type FreitasFilter =
  | { kind: "all" }
  | { kind: "condition"; value: FreitasCondition }
  | { kind: "yard"; value: number }
  | { kind: "type"; value: number };

export function freitasListUrl(auctionId: string, filter: FreitasFilter, page: number): string {
  const params = new URLSearchParams({
    LeilaoId: auctionId,
    Nome: "",
    Lote: "",
    Categoria: "1",
    TipoLoteId: filter.kind === "type" ? String(filter.value) : "0",
    FaixaValor: "0",
    Condicao: filter.kind === "condition" ? filter.value : "",
    PatioId: filter.kind === "yard" ? String(filter.value) : "0",
    AnoModeloMin: "0",
    AnoModeloMax: "0",
    ArCondicionado: "false",
    DirecaoAssistida: "false",
    Tag: "",
    Estado: "",
    Cidade: "",
    ClienteSclId: "0",
    PageNumber: String(page),
    TopRows: String(FREITAS_PAGE_SIZE),
  });
  return `${FREITAS_BASE_URL}/Leiloes/ListarLotes?${params.toString()}`;
}

export const freitasTypesUrl = (auctionId: string) =>
  `${FREITAS_BASE_URL}/Leiloes/PesquisarLotesTipos?categoria=1&leilaoId=${auctionId}`;

export const freitasPhotosUrl = (auctionId: string, lotNumber: number) =>
  `${FREITAS_BASE_URL}/Leiloes/ListarFotosLote?leilaoId=${auctionId}&loteNumero=${lotNumber}`;

/** Valores do filtro "Condição" do site → classificação de dano. */
export const FREITAS_CONDITIONS = {
  sucatas: "salvage",
  "media monta": "medium",
  "pequena monta": "small",
} as const satisfies Record<string, DamageLevel>;
export type FreitasCondition = keyof typeof FREITAS_CONDITIONS;
/** Do mais grave para o menos: lote em dois filtros fica com o mais grave. */
export const FREITAS_CONDITION_ORDER = [
  "sucatas",
  "media monta",
  "pequena monta",
] as const satisfies readonly FreitasCondition[];

/**
 * Pátios do filtro "Visitação/Retirada" (ids do site) e a cidade de cada um, conferida no endereço de retirada das
 * páginas de lote em 01/10/2026. Pátio novo fica sem local (nunca adivinhado) até entrar aqui.
 */
export const FREITAS_YARDS: Record<number, { name: string; city: string; state: string }> = {
  1: { name: "Pátio Utinga", city: "Santo André", state: "SP" },
  2: { name: "Pátio Santo André", city: "Santo André", state: "SP" },
  3: { name: "Pátio Santa Bárbara", city: "Santa Bárbara d'Oeste", state: "SP" },
};

/** Tipos de lote do site (`PesquisarLotesTipos`, nome normalizado) → vocabulário comum (D-37). */
const CATEGORY_BY_TYPE: Record<string, ListingCategory> = {
  "VEICULOS DE PASSEIO": "Carros",
  CARROS: "Carros",
  MOTOS: "Motos",
  "VEICULOS PESADOS": "Pesados",
  CAMINHOES: "Pesados",
  UTILITARIOS: "Utilitarios",
  "VEICULOS UTILITARIOS": "Utilitarios",
};

/**
 * Situação no botão do cartão do lote. Vistas em 01/10/2026: "ABERTO PARA LANCES", "VENDIDO", "CONDICIONAL",
 * "SEM LICITANTES", "RETIRADO" e "BAIXA OFERTA". Baixa oferta não está explicada no site e fica sem mapa:
 * desconhecida depois do fim, como toda situação desconhecida.
 */
const STATUS_BY_TEXT: Record<string, ListingStatus> = {
  "ABERTO PARA LANCES": "open",
  ABERTO: "open",
  "EM LOTEAMENTO": "open",
  "EM BREVE": "open",
  VENDIDO: "sold",
  CONDICIONAL: "conditional",
  "SEM LICITANTES": "unsold",
  "SEM LICITANTE": "unsold",
  RETIRADO: "withdrawn",
};

/** Leilão da agenda com o que ela diz dele. */
export type FreitasAuction = { auctionId: string; local: string; title: string };

/** Leilões da agenda. Só os de veículos interessam (`isVehicleAuction`). */
export function parseFreitasAgenda(html: string): FreitasAuction[] {
  const auctions: FreitasAuction[] = [];
  for (const block of html.split(/class="agenda-content\b/).slice(1)) {
    const auctionId = /leilaoId=(\d+)/i.exec(block)?.[1];
    const paragraphs = [...block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(([, text]) => plain(text ?? ""));
    // <p> data e hora, <p> local, <p> título.
    if (auctionId && !auctions.some((auction) => auction.auctionId === auctionId)) {
      auctions.push({ auctionId, local: paragraphs[1] ?? "", title: paragraphs[2] ?? "" });
    }
  }
  return auctions;
}

/** Confirma que a agenda vazia veio da página esperada do site (e não de erro/manutenção). */
export function isFreitasAgendaPage(html: string): boolean {
  return /agenda-listaLeiloes|Nenhum leil[ãa]o/i.test(decodeHtmlEntities(html));
}

/** Confirma que a página 1 sem cartões trouxe o aviso explícito de lista vazia do site. */
export function isFreitasEmptyList(html: string): boolean {
  return /Nenhum lote localizado/i.test(decodeHtmlEntities(html));
}

/** Leilão de pátio ou de veículos ("PÁTIO UTINGA · VEÍCULOS"); imóveis, materiais e judiciais ficam de fora. */
export function isVehicleAuction(auction: FreitasAuction): boolean {
  return /\bPATIO\b|\bVEICULOS?\b/.test(normalizePlaceName(`${auction.local} ${auction.title}`));
}

/** Cartão de um lote na lista do leilão. */
export type FreitasCard = {
  lotNumber: number;
  /** Número como o site mostra ("002"). */
  lotLabel: string;
  date: string;
  time: string;
  /** "MARCA/MODELO, AA/AA, PLACA: X__-___N, COMBUSTÍVEL, COR", sem placa completa nem chassi. */
  description: string;
  valueText: string;
  /** "Maior lance", "Lance Inicial" ou "Lance Mínimo". */
  valueLabel: string;
  origin: string;
  statusText: string;
  photo: string | null;
};

/** Cartões da lista de um leilão. Página sem cartões ("Nenhum lote localizado") devolve lista vazia. */
export function parseFreitasCards(html: string): FreitasCard[] {
  const cards: FreitasCard[] = [];
  for (const block of html.split(/class="cardlote"/).slice(1)) {
    const lotNumber = Number(/loteNumero=(\d+)/.exec(block)?.[1]);
    if (!Number.isInteger(lotNumber) || lotNumber <= 0) continue;
    const date = /cardLote-data">\s*<span[^>]*>([^<]*)<\/span>\s*<span[^>]*>([^<]*)</.exec(block);
    cards.push({
      lotNumber,
      // Lote "em loteamento" vem sem o número no cartão.
      lotLabel: plain(/cardLote-lote">([^<]*)</.exec(block)?.[1] ?? "") || String(lotNumber).padStart(3, "0"),
      date: plain(date?.[1] ?? ""),
      time: plain(date?.[2] ?? ""),
      description: redactVehicleIds(plain(/cardLote-descVeic">\s*<span>([^<]*)</.exec(block)?.[1] ?? "")),
      valueText: plain(/cardLote-vlr">([^<]*)</.exec(block)?.[1] ?? ""),
      valueLabel: plain(/cardLote-lance">([^<]*)</.exec(block)?.[1] ?? ""),
      origin: plain(/cardLote-details">\s*<span[^>]*>([^<]*)</.exec(block)?.[1] ?? ""),
      statusText: plain(/cardLote-btn[^>]*>([^<]*)</.exec(block)?.[1] ?? ""),
      photo: photoUrl(/<img src="([^"]+)" class="cardLote-img"/.exec(block)?.[1]),
    });
  }
  return cards;
}

/** Tipos de lote do leilão: id e nome. Resposta fora do formato vira lista vazia. */
export function parseFreitasTypes(json: string): { id: number; name: string }[] {
  const parsed = parseJson(json);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item: unknown) => {
    if (!isRecord(item) || typeof item.subTipoId !== "number" || typeof item.nome !== "string") return [];
    return [{ id: item.subTipoId, name: item.nome }];
  });
}

export function categoryOfType(name: string): ListingCategory | null {
  return CATEGORY_BY_TYPE[normalizePlaceName(name)] ?? null;
}

/** Fotos do lote (`ListarFotosLote`), na ordem do site, sem repetir. */
export function parseFreitasPhotos(html: string): string[] {
  const urls = [...html.matchAll(/href="([^"]+)"\s+data-toggle="lightbox"/g)].flatMap(([, url]) => {
    const photo = photoUrl(url);
    return photo ? [photo] : [];
  });
  return [...new Set(urls)];
}

/** A resposta é a página de erro do site ("Ocorreu um erro!"), como a do lote vendido. */
export function isFreitasErrorPage(html: string): boolean {
  return /<title>\s*Ocorreu um erro!/i.test(html);
}

/** O que só a página do lote traz (enquanto ele está aberto). */
export type FreitasPage = {
  /** "I/BYD DOLPHIN MINI GS EV - 2024/2025". */
  title: string | null;
  description: string | null;
  /** Destaques ("IPVA 2026 PAGO", "CRLV DISPONÍVEL"). */
  tags: string[];
  /** Observação do lote ("SEM CHAVE / MOTOR DESMONTADO / …"). */
  notes: string | null;
  commissionPercent: string | null;
  operationalFee: string | null;
  minimumBid: string | null;
  /** "Abertura p/ lances": quando o lote passa a aceitar lances. */
  opensAt: string | null;
  /** Endereço de visitação e retirada. */
  yardAddress: string | null;
};

/** Lê a página do lote. `null`: não é a página de um lote (formato mudou ou página de erro). */
export function parseFreitasPage(rawHtml: string): FreitasPage | null {
  if (isFreitasErrorPage(rawHtml) || !rawHtml.includes("Descrição completa")) return null;
  // Partes comentadas repetem textos (e o modelo do servidor); ficam de fora.
  const html = rawHtml.replace(/<!--[\s\S]*?-->/g, "");
  const after = (marker: string, pattern: RegExp) => {
    const at = html.indexOf(marker);
    return at < 0 ? null : (pattern.exec(html.slice(at + marker.length))?.[1] ?? null);
  };
  const tags = [...html.matchAll(/fa-circle-check"><\/i>([^<]+)</g)].map(([, tag]) => plain(tag ?? ""));
  const notes = after("Leia atentamente as condições antes de participar do leilão:", /<div[^>]*>([\s\S]*?)<\/div>/);

  return {
    title: nonEmpty(plain(after("fa-bookmark", /<\/i>([^<]*)</) ?? "")),
    description: nonEmpty(plain(after("Descrição completa:", /text-align:justify;">([\s\S]*?)<\/div>/) ?? "")),
    tags: tags.filter((tag) => tag !== ""),
    notes: notes === null ? null : nonEmpty(htmlToLines(notes).join(" ")),
    commissionPercent: /([\d.,]+)%<\/span>\s*referente à comissão/.exec(html)?.[1] ?? null,
    operationalFee: /Despesas operacionais no valor de\s*<span[^>]*>\s*R\$\s*([\d.,]+)/.exec(html)?.[1] ?? null,
    minimumBid: /R\$\s*([\d.,]+)<\/div>\s*<small[^>]*>Lance Inicial/.exec(html)?.[1] ?? null,
    opensAt: plain(after("Abertura p/ lances:", /<td>([^<]*)</) ?? "") || null,
    yardAddress: nonEmpty(plain(after("Visitação/Retirada:", /<\/span>([^<]*)</) ?? "")),
  };
}

/** Dado bruto guardado em `listings.raw`: cartão, filtros e página, sem nada de quem deu lance. */
export type FreitasRaw = {
  auctionId: string;
  card: FreitasCard;
  damage: DamageLevel | null;
  typeName: string | null;
  yardId: number | null;
  page: FreitasPage | null;
};

/** Cartão (+ filtros, + página se aberto) → anúncio no formato único. */
export function buildFreitasListing(raw: FreitasRaw, photoUrls: readonly string[], now: Date): ListingInput {
  const { card, page } = raw;
  const externalId = freitasExternalId(raw.auctionId, card.lotNumber);
  const vehicle = vehicleOf(card.description, now);
  const auctionAt = brasiliaDate(card.date, card.time);
  const value = money(card.valueText);
  const hasBids = normalizeNotes(card.valueLabel) === "MAIOR LANCE";

  return {
    externalId,
    url: freitasListingUrl(externalId),
    lotNumber: card.lotLabel,
    title: titleOf(page?.title ?? null, vehicle),
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
      category: raw.typeName === null ? null : categoryOfType(raw.typeName),
      recoveryType: nonEmpty(card.origin),
      hasKey: keyOf(describe(raw)),
    },
    auction: {
      externalId: raw.auctionId,
      // O cartão não traz o nome do leilão; o dia identifica o evento para o usuário.
      name: auctionAt === null ? `Leilão ${raw.auctionId}` : `Leilão de ${formatDate(auctionAt)}`,
      startsAt: auctionAt,
    },
    sellerName: null,
    description: describe(raw),
    condition: conditionOf(raw),
    startsAt: page?.opensAt ? brasiliaDateTime(page.opensAt) : null,
    // Pregão sequencial: o lote é apregoado a partir da hora do leilão. É a melhor data de fim que o site dá.
    endsAt: auctionAt,
    location: placeOf(raw),
    status: mapStatus(card.statusText, auctionAt, now),
    sourceStatus: nonEmpty(card.statusText),
    currentBid: hasBids ? value : null,
    minimumBid: page?.minimumBid ? money(page.minimumBid) : hasBids ? null : value,
    bidCount: hasBids ? null : 0,
    marketValue: null,
    costs: {
      commissionRate: page?.commissionPercent ? toBps(page.commissionPercent) : null,
      dispatcherFee: null,
      removalFee: null,
      storageFee: null,
      inspectionFee: null,
      otherFees: page?.operationalFee ? money(page.operationalFee) : null,
    },
    photoUrls: photoUrls.length > 0 ? [...photoUrls] : card.photo ? [card.photo] : [],
    raw,
  };
}

/** Descrição, condição e situação a partir de `raw`. */
export function freitasDetailsFromRaw(raw: unknown, now: Date): ListingDetails | null {
  const parsed = readRaw(raw);
  if (!parsed) return null;
  return {
    description: describe(parsed),
    condition: conditionOf(parsed),
    status: mapStatus(parsed.card.statusText, brasiliaDate(parsed.card.date, parsed.card.time), now),
    sourceStatus: nonEmpty(parsed.card.statusText),
  };
}

function describe(raw: Pick<FreitasRaw, "card" | "page">): string | null {
  const { card, page } = raw;
  const parts = page
    ? [page.description ?? card.description, page.tags.join(" / "), page.notes ?? ""]
    : [card.description];
  return cleanDescription(redactVehicleIds(parts.filter((part) => part !== "").join("\n")));
}

/** Monta e sucata pelo filtro do site; o texto ainda pode citar uma mais grave e as marcações (circulação vedada…). */
function conditionOf(raw: FreitasRaw): ListingInput["condition"] {
  const fromText = parseConditionNotes(describe(raw));
  return {
    ...fromText,
    damageLevel: worstDamage(raw.damage, fromText.damageLevel),
    inspection: null,
    inspectionNotes: null,
  };
}

/** Lote ainda aberto, pela situação do cartão: só então a página do lote existe e vale a requisição. */
export function isFreitasOpen(card: Pick<FreitasCard, "statusText">): boolean {
  return STATUS_BY_TEXT[normalizePlaceName(card.statusText)] === "open";
}

function mapStatus(text: string, endsAt: Date | null, now: Date): ListingStatus {
  const known = STATUS_BY_TEXT[normalizePlaceName(text)];
  if (known) return known;
  return endsAt !== null && endsAt < now ? "unknown" : "open";
}

/**
 * Local: o endereço de retirada da página (aberto) ou, sem ela, a cidade do pátio do filtro. Endereço termina em
 * "- CIDADE/UF"; o site escreve "SANTA BARBARA D OESTE", que vira "D'OESTE" para casar com o IBGE.
 */
function placeOf(raw: FreitasRaw): ListingInput["location"] {
  const yard = raw.yardId === null ? undefined : FREITAS_YARDS[raw.yardId];
  const address = raw.page?.yardAddress ?? null;
  const match = address ? /^(.*)\s-\s*([^-/]+?)\s*\/\s*([A-Z]{2})$/i.exec(address) : null;
  const city = match?.[2] ? match[2].replace(/\bD\s+(?=[AEIOU])/gi, "D'") : null;
  const state = match?.[3] ? stateCode(match[3]) : null;
  if (city && state) {
    // Mesma cidade do pátio: o nome da tabela, bem escrito ("Santo André" e não "SANTO ANDRE").
    const sameCity = yard?.state === state && normalizePlaceName(yard.city) === normalizePlaceName(city);
    return {
      yardName: yard?.name ?? null,
      city: sameCity ? yard.city : city,
      state,
      address: match?.[1]?.trim() || null,
    };
  }
  if (yard) return { yardName: yard.name, city: yard.city, state: yard.state, address };
  return { yardName: null, city: null, state: null, address };
}

type CardVehicle = {
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  manufactureYear: number | null;
  fuel: string | null;
  color: string | null;
};

/**
 * "I/BYD DOLPHIN MINI GS EV, 24/25, PLACA: E__-___2, ELETR/FONTE EXT, PRETA". "I/" marca importado. Máquina sem placa
 * traz um ano só, com 4 dígitos ("TRATOR JOHN DEERE 6170M, 2020 , DIESEL, VERDE").
 */
function vehicleOf(description: string, now: Date): CardVehicle {
  const parts = description.split(",").map((part) => part.trim());
  const name = (parts[0] ?? "").replace(/^I\//i, "");
  const { brand, model } = name.includes("/")
    ? splitBrandModel(name)
    : { brand: name.split(" ")[0] || null, model: name.split(" ").slice(1).join(" ") || null };
  const yearsAt = parts.findIndex((part) => /^(?:\d{2}|\d{4})(?:\/(?:\d{2}|\d{4}))?$/.test(part));
  const [made, modelYear = made] = yearsAt < 0 ? [] : (parts[yearsAt]?.split("/") ?? []);
  const plateAt = parts.findIndex((part) => /^PLACA\b/i.test(part));
  // Combustível e cor vêm depois da placa ou, sem placa, depois do ano.
  const after = plateAt >= 0 ? plateAt : yearsAt;
  const rest = after < 0 ? [] : parts.slice(after + 1);
  return {
    brand,
    model,
    modelYear: toYear(modelYear, now),
    manufactureYear: toYear(made, now),
    fuel: nonEmpty(rest[0] ?? ""),
    color: nonEmpty(rest[1] ?? ""),
  };
}

function titleOf(pageTitle: string | null, vehicle: CardVehicle): string {
  if (pageTitle) return pageTitle;
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  return [name, vehicle.modelYear].filter(Boolean).join(" ") || "Lote sem descrição";
}

function keyOf(description: string | null): boolean | null {
  const text = normalizeNotes(description ?? "");
  if (/\bSEM CHAVES?\b/.test(text)) return false;
  if (/\bCOM CHAVES?\b/.test(text)) return true;
  return null;
}

/** Ano de 2 dígitos do site: até o ano que vem é 20xx; depois, 19xx. Com 4 dígitos, como está. */
function toYear(value: string | undefined, now: Date): number | null {
  if (value !== undefined && /^\d{4}$/.test(value)) return Number(value);
  if (value === undefined || !/^\d{2}$/.test(value)) return null;
  const twoDigits = Number(value);
  const nextYear = (now.getUTCFullYear() + 1) % 100;
  return twoDigits <= nextYear ? 2000 + twoDigits : 1900 + twoDigits;
}

function brasiliaDate(date: string, time: string): Date | null {
  return parseBrasiliaDateTime(`${date} ${time}`);
}

/** "24/09/2026 08:38". */
function brasiliaDateTime(text: string): Date | null {
  return parseBrasiliaDateTime(text);
}

function money(text: string): Cents | null {
  const cleaned = text.replace(/[^\d.,-]/g, "");
  if (cleaned === "") return null;
  const value = parseBRL(cleaned);
  return value !== null && value > 0 ? value : null;
}

function toBps(percent: string) {
  const value = Number(percent.replace(",", "."));
  return Number.isFinite(value) && value >= 0 && value <= 100 ? bps(Math.round(value * 100)) : null;
}

function photoUrl(url: string | undefined): string | null {
  return url?.startsWith(`${FREITAS_IMAGE_ORIGIN}/`) ? url : null;
}

function readRaw(raw: unknown): FreitasRaw | null {
  if (!isRecord(raw) || typeof raw.auctionId !== "string" || !isRecord(raw.card)) return null;
  const card = raw.card;
  const text = (key: string) => (typeof card[key] === "string" ? card[key] : "");
  if (typeof card.lotNumber !== "number") return null;
  const page = isRecord(raw.page) ? readPage(raw.page) : null;
  const damage = Object.values(FREITAS_CONDITIONS).find((level) => level === raw.damage) ?? null;
  return {
    auctionId: raw.auctionId,
    card: {
      lotNumber: card.lotNumber,
      lotLabel: text("lotLabel"),
      date: text("date"),
      time: text("time"),
      description: text("description"),
      valueText: text("valueText"),
      valueLabel: text("valueLabel"),
      origin: text("origin"),
      statusText: text("statusText"),
      photo: typeof card.photo === "string" ? card.photo : null,
    },
    damage,
    typeName: typeof raw.typeName === "string" ? raw.typeName : null,
    yardId: typeof raw.yardId === "number" ? raw.yardId : null,
    page,
  };
}

function readPage(page: Record<string, unknown>): FreitasPage {
  const text = (key: string) => (typeof page[key] === "string" ? page[key] : null);
  return {
    title: text("title"),
    description: text("description"),
    tags: Array.isArray(page.tags) ? page.tags.filter((tag): tag is string => typeof tag === "string") : [],
    notes: text("notes"),
    commissionPercent: text("commissionPercent"),
    operationalFee: text("operationalFee"),
    minimumBid: text("minimumBid"),
    opensAt: text("opensAt"),
    yardAddress: text("yardAddress"),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
