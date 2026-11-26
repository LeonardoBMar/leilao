import { z } from "zod";

import { normalizeNotes, parseConditionNotes, worstDamage } from "@/domain/listings/condition";
import { stateCode } from "@/domain/listings/place";
import type { ListingCategory, ListingInput, ListingStatus } from "@/domain/listings/types";
import { type Cents, cents, parseBRL } from "@/domain/money";

import { LANCE_CERTO_IMAGE_ORIGIN } from "../image-origins";
import { splitDetranVehicle } from "../shared/detran-vehicle";
import { decodeHtmlEntities, htmlToText as plain, nonEmpty, uniqueNonEmpty as unique } from "../shared/extract";
import { REDACTED, redactVehicleIds } from "../shared/redact";
import { categoryOfVehicle, isKnownVehicleBrand } from "../shared/vehicle-category";
import type { ListingDetails } from "../types";
import { type LanceCertoRaw, lanceCertoRawSchema } from "./schema";

export const LANCE_CERTO_BASE_URL = "https://www.lancecertoleiloes.com.br";
export const LANCE_CERTO_NAME = "Lance Certo Leilões";

/** Leilões abertos e futuros, em páginas (o JSON que a página inicial usa). */
export const lanceCertoHomeUrl = (page: number) => `${LANCE_CERTO_BASE_URL}/ajaxhomeLanceCerto/${page}/0/0/0/0/`;

/** Lotes de um leilão, 32 por página. */
export const lanceCertoAuctionUrl = (edital: string, page = 1) =>
  page <= 1 ? `${LANCE_CERTO_BASE_URL}/leilao/${edital}` : `${LANCE_CERTO_BASE_URL}/leilao/${edital}?pag=${page}`;

/**
 * Anúncio = lote, pelo edital e o id do lote ("271026PRFVE/946083"): a página do lote só abre com o edital certo na
 * URL.
 */
export const lanceCertoExternalId = (edital: string, lotId: string) => `${edital}/${lotId}`;

export function splitLanceCertoExternalId(externalId: string): { edital: string; lotId: string } | null {
  const match = /^([A-Za-z0-9-]+)\/(\d+)$/.exec(externalId);
  return match?.[1] && match[2] ? { edital: match[1], lotId: match[2] } : null;
}

export function lanceCertoListingUrl(externalId: string): string {
  const id = splitLanceCertoExternalId(externalId);
  return id
    ? `${LANCE_CERTO_BASE_URL}/leilao/${id.edital}/lote/${id.lotId}`
    : `${LANCE_CERTO_BASE_URL}/leilao/${externalId}`;
}

const homeSchema = z.object({
  Home: z.object({ LeilaoPaginas: z.number().int() }),
  Leilao: z.array(z.object({ Edital: z.string(), Lotes: z.string().nullable() })),
});

/**
 * Editais da página da lista e o total de páginas. Leilão "Em loteamento" ainda não tem lotes e fica de fora.
 * `null`: a resposta não é a lista (o site mudou).
 */
export function parseLanceCertoHome(text: string): { editais: string[]; pages: number } | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = homeSchema.safeParse(json);
  if (!parsed.success) return null;
  const editais = parsed.data.Leilao.filter((auction) => !/loteamento/i.test(auction.Lotes ?? "")).map(
    (auction) => auction.Edital,
  );
  return {
    editais: unique(editais.filter((edital) => /^[A-Za-z0-9-]+$/.test(edital))),
    pages: parsed.data.Home.LeilaoPaginas,
  };
}

export type LanceCertoCard = { lotId: string; category: string; description: string };

/**
 * Página de um leilão: os cartões dos lotes (categoria e começo da descrição), a última página e a UF do leilão.
 * `null`: não é a página de um leilão (o site mudou).
 */
export function parseLanceCertoAuctionPage(
  html: string,
  edital: string,
): { cards: LanceCertoCard[]; lastPage: number; state: string | null } | null {
  if (!html.includes("ContentPlaceHolder1_lblLeilaoLocal")) return null;
  const escaped = edital.replace(/[-]/g, "\\-");
  // A página traz também cartões de exemplo do tema (edital "TESTEVIP"): só os do próprio leilão contam.
  const cardPattern = new RegExp(
    `<a href="https://www\\.lancecertoleiloes\\.com\\.br/leilao/${escaped}/lote/(\\d+)">([\\s\\S]*?)</a>`,
    "gi",
  );
  const cards = new Map<string, LanceCertoCard>();
  for (const [, lotId = "", card = ""] of html.matchAll(cardPattern)) {
    if (cards.has(lotId)) continue;
    cards.set(lotId, {
      lotId,
      category: plain(/<strong>([\s\S]*?)<\/strong>/.exec(card)?.[1] ?? ""),
      description: plain(/class="lote-descricao[^"]*">([\s\S]*?)<\/div>/.exec(card)?.[1] ?? ""),
    });
  }
  const pages = [...html.matchAll(new RegExp(`/leilao/${escaped}\\?pag=(\\d+)`, "gi"))].map(([, page]) => Number(page));
  return { cards: [...cards.values()], lastPage: Math.max(1, ...pages), state: auctionStateOf(html) };
}

/**
 * UF do leilão pelo texto da página dele: "DETRAN/RN", "SPRF PE", "Caicó/RN", "(PERNAMBUCO)". A mais citada vale; empate
 * ou nenhuma, `null` (nunca adivinhada).
 */
export function auctionStateOf(html: string): string | null {
  const start = html.indexOf("ContentPlaceHolder1_lblLeilaoLocal");
  const end = html.indexOf("Por p&#225;gina", start);
  if (start < 0) return null;
  const text = normalizeNotes(
    plain(html.slice(start, end < 0 ? undefined : end).replace(/<style[\s\S]*?<\/style>/gi, " ")),
  );
  const counts = new Map<string, number>();
  const count = (state: string | null) => {
    if (state) counts.set(state, (counts.get(state) ?? 0) + 1);
  };
  for (const [, code = ""] of text.matchAll(/(?:\/|\bDETRAN\s*[-/]?\s*|\bS?PRF\s*[-/]?\s*|\s-\s)([A-Z]{2})\b/g)) {
    count(ufOf(code));
  }
  for (const [, name = ""] of text.matchAll(/\(([A-Z ]{4,})\)/g)) count(stateCode(name));
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  if (!first || (second && second[1] === first[1])) return null;
  return first[0];
}

/** Cartão de lote de veículo: não é imóvel e a descrição tem marca/modelo de veículo. */
export function isLanceCertoVehicleCard(card: LanceCertoCard): boolean {
  if (/^IM[ÓO]VE/i.test(card.category)) return false;
  return isLanceCertoVehicle(card.description);
}

/**
 * Lote de um veículo só: marca/modelo no formato do registro ("VW/GOL SPECIAL", "I/SSANGYONG ACTYON") com marca
 * conhecida ou o tipo do veículo no texto, ou o texto livre das prefeituras ("GOL TL MCV, ANO 2018, COR BRANCA, PLACA
 * …"). Lote com vários veículos ("ITEM 2", "03 SUCATAS", dois pares de anos), máquinas, reboques e materiais ficam de
 * fora.
 */
export function isLanceCertoVehicle(description: string): boolean {
  const text = normalizeNotes(description);
  if (/\bITEM\s*0?2\b|\b0?[2-9]\s+(?:SUCATAS|VEICULOS|MOTOS)\b/.test(text)) return false;
  if ((text.match(YEAR_PAIRS) ?? []).length > 1) return false;
  const vehicle = vehicleToken(text);
  if (vehicle === null) return false;
  return vehicle.known || VEHICLE_WORD.test(text);
}

const VEHICLE_WORD =
  /\b(?:VEICULO|CARRO|AUTOMOVEL|MOTO|MOTOCICLETA|MOTONETA|CICLOMOTOR|CAMINHONETE|CAMIONETA|CAMINHAO|ONIBUS|SUCATA)\b/;
const MOTO_WORD = /\b(?:MOTO|MOTOCICLETA|MOTONETA|CICLOMOTOR)\b/;
const HEAVY_WORD = /\b(?:CAMINHAO|ONIBUS|MICRO-?ONIBUS|CAVALO MECANICO)\b/;
const MACHINE_WORD = /\b(?:TRATOR|RETRO|ESCAVADEIRA|ENSILADEIRA|MAQUINA|REBOQUE|CARROCA|IMPLEMENTO)/;
const YEAR_PAIRS = /\b(?:19|20)\d{2}\s*\/\s*(?:19|20)\d{2}\b/g;
/** Marcas fora da lista comum que aparecem nos leilões de órgão público. */
const EXTRA_BRANDS = new Set(["VOLVO", "AGRALE", "MARCOPOLO", "CAOA", "LIFAN", "JINCHENG", "HAOJIN"]);
const COLOR =
  /\b(BRANC[AO]|PRET[AO]|PRATA|VERMELH[AO]|AZUL|CINZA|VERDE|AMAREL[AO]|BEGE|MARROM|DOURAD[AO]|LARANJA|ROX[AO]|VINHO|FANTASIA|ROSA|GRENA)\b/;
const TRAILING_COLOR = new RegExp(`\\s+${COLOR.source}.*$`);
/** Barras que não são de marca/modelo: "S/REGISTRO", "S/INFO", "ALCOOL/GASOL". */
const OTHER_SLASHES = /\bS\/\s?(?:REGISTRO|INFO|PLACA)\b|\b(?:ALCO(?:OL)?|GASOL(?:INA)?|ETANOL|FLEX|DIESEL)\/[A-Z]+/g;
const BRAND_MODEL = /(?:^|[\s,|])((?:(?:I|IMP)\/\s?)?[A-Z][A-Z.]*(?:-[A-Z]+)?\/\s?[A-Z0-9][^,\t\r\n|]*)/g;

type VehicleToken = { name: string; brand: string | null; model: string | null; known: boolean };

/**
 * Marca e modelo do lote: o primeiro "MARCA/MODELO" do texto ou, no texto livre com "ANO 2018", o trecho antes da
 * primeira vírgula ("FIAT UNO MILLE WAY ECON", "SUCATA DE UNO MILLE FIRE FLEX"), com a marca só se for conhecida.
 */
function vehicleToken(text: string): VehicleToken | null {
  const clean = text.replace(OTHER_SLASHES, " ");
  for (const [, token = ""] of clean.matchAll(BRAND_MODEL)) {
    const name = modelName(token);
    if (!name) continue;
    const split = splitDetranVehicle(name);
    if (split.brand === null || split.model === null) continue;
    const known = isKnownVehicleBrand(split.brand) || EXTRA_BRANDS.has(split.brand);
    return { name, ...split, known };
  }
  if (!/\bANO\s*:?\s*(?:19|20)\d{2}\b/.test(clean) || MACHINE_WORD.test(clean)) return null;
  const name = modelName(
    (clean.split(",")[0] ?? "")
      .replace(/^SUCATA\s+(?:DE\s+)?/, "")
      .replace(/^(?:MOTO|ONIBUS|CAMINHAO(?:\s+TANQUE)?|AMBULANCIA|VEICULO)\s+/, "")
      .replace(/\s+ANO\b.*$/, ""),
  );
  if (!name) return null;
  const [first = "", ...rest] = name.split(" ");
  const known = isKnownVehicleBrand(first) || EXTRA_BRANDS.has(first);
  return known
    ? { name, brand: first, model: rest.join(" ") || null, known: true }
    : { name, brand: null, model: name, known: true };
}

/** "FIAT/TORO ENDUR AT9 4X4 - MOTOR DESMONTADO" → "FIAT/TORO ENDUR AT9 4X4"; sem anos e cor no fim. */
function modelName(token: string): string {
  return (token.split(/\s+-\s+/)[0] ?? "")
    .replace(/\s+(?:19|20)\d{2}\s*\/.*$/, "")
    .replace(/\s+(?:NA\s+)?COR\b.*$/, "")
    .replace(TRAILING_COLOR, "")
    .replace(/\/\s+/, "/")
    .replace(/[.\s]+$/, "")
    .trim();
}

type LotPage = Omit<LanceCertoRaw, "auctionState">;

/**
 * Página de um lote. `"gone"`: o site devolve a página vazia (lote que não existe ou fora deste edital). `null`: a
 * página não tem o formato esperado (o site mudou).
 */
export function parseLanceCertoLotPage(html: string, edital: string, lotId: string): LotPage | "gone" | null {
  if (!html.includes("ContentPlaceHolder1_lblStatus")) return null;
  if (span(html, "lblID") === null) return "gone";
  const bidCount = Number(span(html, "lblLanceNumero") ?? "");
  const value = span(html, "lblValorAtual");
  const fraction = span(html, "lblValroCentavo") ?? ",00";
  const adminFee = /TAXA ADMINISTRATIVA:?\s*R\$\s*([\d.]+,\d{2})/i.exec(span(html, "lblAnotacao") ?? "")?.[1];
  return {
    edital,
    lotId,
    lotNumber: span(html, "lblLote"),
    statusText: span(html, "lblStatus"),
    bid: value === null ? null : parseBRL(`${value}${fraction}`),
    bidCount: Number.isInteger(bidCount) ? bidCount : 0,
    startingBid: parseBRL(span(html, "lblLanceinicial") ?? ""),
    adminFee: adminFee ? parseBRL(adminFee) : null,
    endsAt: recifeDate(span(html, "lblDataleilao"))?.toISOString() ?? null,
    seller: span(html, "lblComitente"),
    notes: span(html, "lblAnotacao"),
    // Placa, chassi, Renavam e número do motor saem já aqui: nem o `raw` os guarda (D-40).
    description: cleanLanceCertoDescription(rawSpan(html, "lblOutros") ?? ""),
    photos: unique(
      [...html.matchAll(/data-lightbox="leilao" href="([^"]+)"/g)]
        .map(([, url = ""]) => url)
        .filter((url) => url.startsWith(`${LANCE_CERTO_IMAGE_ORIGIN}/controle/galeria/`)),
    ),
  };
}

/**
 * Descrição sem identificadores. As linhas do Detran e da PRF vêm em colunas separadas por tabulação (placa, UF,
 * marca/modelo, Renavam, chassi, motor, anos, cor…): colunas que são um código só (letras e números, 7 ou mais) saem.
 * No texto livre, a redação comum e o número do motor depois do rótulo.
 */
export function cleanLanceCertoDescription(html: string): string {
  const text = decodeHtmlEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " "));
  const lines = text
    .split(/\r?\n/)
    .map((line) =>
      line
        .split("\t")
        .map((field) => field.replace(/\s+/g, " ").trim())
        .filter((field) => field !== "" && !/^(?=[A-Z0-9*-]*\d)[A-Z0-9*-]{7,}$/i.test(field))
        .join(", "),
    )
    .filter((line) => line !== "");
  return redactVehicleIds(lines.join(" "))
    .replace(/\b(MOTOR)(\s*(?:N[º°O.]*)?\s*:?\s*)(?=[A-Z0-9-]*\d)[A-Z0-9-]{6,}/gi, `$1$2${REDACTED}`)
    .replace(/\b\d{9,11}\b/g, REDACTED);
}

/** Dado bruto → anúncio no formato único. */
export function buildLanceCertoListing(raw: LanceCertoRaw, now: Date): ListingInput {
  const vehicle = parseLanceCertoDescription(raw.description, raw.notes);
  const endsAt = isoDate(raw.endsAt);
  const externalId = lanceCertoExternalId(raw.edital, raw.lotId);
  const hasBids = (raw.bidCount ?? 0) > 0;

  return {
    externalId,
    url: lanceCertoListingUrl(externalId),
    lotNumber: raw.lotNumber,
    title: vehicle.name ?? (raw.description.slice(0, 80) || "Lote sem descrição"),
    vehicle: {
      brand: vehicle.brand,
      model: vehicle.model,
      fipeCode: null,
      fipeName: null,
      modelYear: vehicle.modelYear,
      manufactureYear: vehicle.manufactureYear,
      mileageKm: null,
      fuel: null,
      color: vehicle.color,
      category: vehicle.category,
      recoveryType: null,
      hasKey: null,
    },
    auction: { externalId: raw.edital, name: raw.seller ?? raw.edital, startsAt: null },
    sellerName: raw.seller,
    description: raw.description || null,
    condition: conditionOf(raw),
    startsAt: null,
    endsAt,
    location: placeOf(raw.seller, raw.auctionState),
    status: mapStatus(raw, endsAt, now),
    sourceStatus: raw.statusText,
    // Sem lance, o "valor atual" da página é o lance inicial.
    currentBid: hasBids ? asCents(raw.bid) : null,
    minimumBid: asCents(raw.startingBid),
    bidCount: raw.bidCount,
    marketValue: null,
    costs: {
      commissionRate: null,
      dispatcherFee: null,
      removalFee: null,
      storageFee: null,
      inspectionFee: null,
      otherFees: asCents(raw.adminFee),
    },
    photoUrls: raw.photos,
    raw,
  };
}

/** Descrição, condição e situação a partir de `raw`. */
export function lanceCertoDetailsFromRaw(raw: unknown, now: Date): ListingDetails | null {
  const parsed = lanceCertoRawSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    description: parsed.data.description || null,
    condition: conditionOf(parsed.data),
    status: mapStatus(parsed.data, isoDate(parsed.data.endsAt), now),
    sourceStatus: parsed.data.statusText,
  };
}

/**
 * Situação da página. O site não diz "vendido": depois do pregão o lote fica "Encerrado" com o valor vencedor, e o que
 * não foi vendido fica "Suspenso" (listado como "RETIRADO" no leilão). Em leilão de órgão público o maior lance é a
 * venda, então "Encerrado" com lance é vendido pelo valor atual (decisão do usuário, D-69); sem lance, não vendido.
 */
function mapStatus(
  raw: Pick<LanceCertoRaw, "statusText" | "bidCount" | "bid">,
  endsAt: Date | null,
  now: Date,
): ListingStatus {
  const status = normalizeNotes(raw.statusText ?? "");
  if (/VENDID|ARREMATAD/.test(status)) return "sold";
  if (/CONDICION/.test(status)) return "conditional";
  if (/ENCERRAD/.test(status)) return (raw.bidCount ?? 0) > 0 && raw.bid !== null ? "sold" : "unsold";
  if (/SUSPENS|RETIRAD|CANCELAD/.test(status)) return "withdrawn";
  if (/ABERT|BREVE|LOTEAMENTO|DOU-LHE|PREGAO/.test(status)) return "open";
  return endsAt !== null && endsAt < now ? "unknown" : "open";
}

function conditionOf(raw: Pick<LanceCertoRaw, "description" | "notes">): ListingInput["condition"] {
  const text = `${raw.description} ${raw.notes ?? ""}`;
  const notes = parseConditionNotes(text);
  const salvage = /\bSUCATA\b/.test(normalizeNotes(text)) ? "salvage" : null;
  return { ...notes, damageLevel: worstDamage(notes.damageLevel, salvage), inspection: null, inspectionNotes: null };
}

/**
 * Município e UF. Comitente de prefeitura: o município dele ("PREF MUNICIPAL DE IBIMIRIM/PE"); outro comitente com UF
 * no fim ("SPRF PE", "DETRAN PE"): só a UF; sem isso, a UF do leilão. Pátio e endereço não vêm no lote.
 */
export function placeOf(seller: string | null, auctionState: string | null): ListingInput["location"] {
  const name = normalizeNotes(seller ?? "");
  const cityHall =
    /\bPREF(?:EITURA|\.)?\s+(?:M\.|MUN\.?|MUNICIPAL)\s+(?:D[AEO]S?\s+)?(.+?)\s*(?:[-–/]\s*|\s+)([A-Z]{2})$/.exec(name);
  const cityHallState = cityHall?.[2] ? ufOf(cityHall[2]) : null;
  if (cityHall?.[1] && cityHallState) {
    return { yardName: null, city: cityHall[1].trim(), state: cityHallState, address: null };
  }
  const sellerState = /(?:[-–/]\s*|\s)([A-Z]{2})$/.exec(name)?.[1];
  return { yardName: null, city: null, state: (sellerState ? ufOf(sellerState) : null) ?? auctionState, address: null };
}

export type LanceCertoVehicle = {
  /** Marca e modelo como o lote escreve ("VW/GOL SPECIAL"). */
  name: string | null;
  brand: string | null;
  model: string | null;
  manufactureYear: number | null;
  modelYear: number | null;
  color: string | null;
  category: ListingCategory | null;
};

/**
 * Descrição já limpa: "VEÍCULO, HONDA/CG 125 TITAN, VERMELHA, 1996/1996" (Detran-RN), "PE, HONDA/XR 250 TORNADO,
 * Motocicleta, 2005, 2005, PRETA, CONSERVADO, …" (PRF) ou texto livre com a marca/modelo.
 */
export function parseLanceCertoDescription(description: string, notes: string | null): LanceCertoVehicle {
  const text = normalizeNotes(description);
  const token = vehicleToken(text);
  const pair =
    /\b((?:19|20)\d{2})\s*\/\s*((?:19|20)\d{2})\b/.exec(text) ??
    /,\s*((?:19|20)\d{2}),\s*((?:19|20)\d{2})\b/.exec(text);
  const single = /\bANO\s*:?\s*((?:19|20)\d{2})\b/.exec(text)?.[1];
  const salvage = /\bSUCATA\b/.test(`${text} ${normalizeNotes(notes ?? "")}`);
  return {
    name: token?.name ?? null,
    brand: token?.brand ?? null,
    model: token?.model ?? null,
    manufactureYear: year(pair?.[1] ?? single),
    modelYear: year(pair?.[2] ?? single),
    color: COLOR.exec(text)?.[1] ?? null,
    category: token ? categoryOf(text, token, salvage) : null,
  };
}

function categoryOf(
  text: string,
  token: { brand: string | null; model: string | null },
  salvage: boolean,
): ListingCategory | null {
  if (salvage) return "Sucatas";
  if (HEAVY_WORD.test(text)) return "Pesados";
  if (MOTO_WORD.test(text)) return "Motos";
  return categoryOfVehicle(token.brand, token.model);
}

/** "30/09/2026  10h00" no horário de Recife (UTC−3, sem horário de verão). */
function recifeDate(text: string | null): Date | null {
  const match = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2})h(\d{2})?/.exec(text ?? "");
  if (!match) return null;
  const [, day, month, yearText, hour = "0", minute = "00"] = match;
  const date = new Date(`${yearText}-${month}-${day}T${hour.padStart(2, "0")}:${minute}:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function year(value: string | undefined): number | null {
  return value === undefined ? null : Number(value);
}

function ufOf(code: string): string | null {
  return code.length === 2 ? stateCode(code) : null;
}

function asCents(value: number | null): Cents | null {
  return value === null || value <= 0 ? null : cents(value);
}

function isoDate(value: string | null): Date | null {
  if (value === null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Texto de um `<span id="ContentPlaceHolder1_…">`, sem marcação; vazio vira `null`. */
function span(html: string, id: string): string | null {
  const value = rawSpan(html, id);
  return value === null ? null : nonEmpty(plain(value));
}

function rawSpan(html: string, id: string): string | null {
  return new RegExp(`id="ContentPlaceHolder1_${id}"[^>]*>([\\s\\S]*?)</span>`).exec(html)?.[1] ?? null;
}
