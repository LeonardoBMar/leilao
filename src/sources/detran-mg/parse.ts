import { z } from "zod";

import { EMPTY_CONDITION, type ListingCondition } from "@/domain/listings/condition";
import { normalizePlaceName } from "@/domain/listings/place";
import type { ListingCategory, ListingInput, ListingStatus } from "@/domain/listings/types";
import { type Cents, parseBRL } from "@/domain/money";
import { err, ok, type Result } from "@/lib/result";

import { DETRAN_MG_IMAGE_ORIGIN } from "../image-origins";
import { splitDetranVehicle } from "../shared/detran-vehicle";
import { decodeHtmlEntities, htmlToLines } from "../shared/extract";
import type { ListingDetails, ParseError } from "../types";
import { type DetranLiveLot, detranLiveLotSchema, detranLiveResponseSchema } from "./schema";

export const DETRAN_MG_BASE_URL = "https://leilao.detran.mg.gov.br";
export const DETRAN_MG_NAME = "Detran-MG";
/** Consulta interna que a tela usa para atualizar valor, situação e cronômetro. */
export const DETRAN_MG_LIVE_URL = `${DETRAN_MG_BASE_URL}/PDO/updateCountdown.php`;
/** Maior página que o site aceita (`?limit=`); acima disso ele devolve 100 do mesmo jeito. */
export const DETRAN_MG_PAGE_SIZE = 100;

/** Id do anúncio: `{leilão}-{lote}`, os dois ids internos do site. O leilão diz onde está a lista do lote. */
export const detranExternalId = (auctionId: string, lotId: string) => `${auctionId}-${lotId}`;

export function parseDetranExternalId(externalId: string): { auctionId: string; lotId: string } | null {
  const match = /^(\d+)-(\d+)$/.exec(externalId);
  return match?.[1] && match[2] ? { auctionId: match[1], lotId: match[2] } : null;
}

export const detranLotUrl = (lotId: string) => `${DETRAN_MG_BASE_URL}/lotes/detalhes/${lotId}`;

export function detranListingUrl(externalId: string): string {
  const id = parseDetranExternalId(externalId);
  return detranLotUrl(id?.lotId ?? externalId);
}

/** Lista de lotes de um leilão. O ano da URL é o do leilão; a página do site o repete em todos os links. */
export const detranAuctionUrl = (auction: DetranAuctionRef, page: number) =>
  `${DETRAN_MG_BASE_URL}/lotes/lista-lotes/${auction.id}/${auction.year}?page=${page}&limit=${DETRAN_MG_PAGE_SIZE}`;

export const detranLiveUrl = (lotIds: readonly string[]) =>
  `${DETRAN_MG_LIVE_URL}?user=&${lotIds.map((id) => `data%5B%5D=${encodeURIComponent(id)}`).join("&")}`;

export type DetranAuctionRef = { id: string; year: string };

/** Leilões abertos da página inicial (`/lotes/lista-lotes/{id}/{ano}`), sem repetição. */
export function parseDetranHome(html: string): DetranAuctionRef[] {
  const found = new Map<string, DetranAuctionRef>();
  for (const match of html.matchAll(/href="\/lotes\/lista-lotes\/(\d+)\/(\d{4})"/g)) {
    const [, id, year] = match;
    if (id && year && !found.has(id)) found.set(id, { id, year });
  }
  return [...found.values()];
}

/** O que a lista do leilão diz de cada lote. `vehicle` é "MARCA/MODELO" (sem o ano), quando o site informa. */
const cardSchema = z.object({
  lotId: z.string(),
  lotNumber: z.string(),
  condition: z.string().nullable(),
  vehicle: z.string().nullable(),
  year: z.number().int().nullable(),
  value: z.string().nullable(),
  photo: z.string().nullable(),
});
export type DetranCard = z.infer<typeof cardSchema>;

const auctionSchema = z.object({
  id: z.string(),
  /** Número do leilão para o público ("Leilão 1875"), diferente do id interno da URL. */
  number: z.string().nullable(),
  city: z.string().nullable(),
  /** Pátio, já sem CPF ou CNPJ (o site às vezes escreve o documento de quem mantém o pátio). */
  yard: z.string().nullable(),
});
export type DetranAuction = z.infer<typeof auctionSchema>;

export type DetranAuctionPage = { auction: DetranAuction; cards: DetranCard[]; lastPage: number };

/**
 * Lista de lotes de um leilão. Leilão encerrado (ou página além da última) redireciona para a página inicial:
 * sem o cabeçalho "Leilão N - CIDADE" a página não é uma lista e volta `null`.
 */
export function parseDetranAuctionPage(html: string, auctionId: string): DetranAuctionPage | null {
  const header = /<h4>\s*Leil(?:ã|&atilde;)o\s+(\d+)\s*-\s*([^<]+?)\s*<\/h4>/i.exec(html);
  if (!header) return null;
  const yard = /<h6>\s*Patio:\s*([^<]*)<\/h6>/i.exec(html)?.[1];
  const auction: DetranAuction = {
    id: auctionId,
    number: header[1] ?? null,
    city: nonEmpty(decodeHtmlEntities(header[2] ?? "")),
    yard: yard === undefined ? null : nonEmpty(redactPersonalIds(decodeHtmlEntities(yard))),
  };

  const cards: DetranCard[] = [];
  const blocks = html.split(/<div class="card listaLotes" id="/).slice(1);
  for (const block of blocks) {
    const card = parseCard(block);
    if (card) cards.push(card);
  }
  const pages = [...html.matchAll(/[?&](?:amp;)?page=(\d+)/g)].map((match) => Number(match[1]));
  return { auction, cards, lastPage: Math.max(1, ...pages) };
}

function parseCard(block: string): DetranCard | null {
  const lotId = /^(\d+)"/.exec(block)?.[1];
  const lotNumber = /<span>\s*Lote\s+(\w+)\s*<\/span>/.exec(block)?.[1];
  if (!lotId || !lotNumber) return null;
  const condition = /<\/span>\s*-\s*<span[^>]*>\s*([^<]+?)\s*<\/span>/.exec(block)?.[1] ?? null;
  // "<b>HONDA/CG 125 FAN KS 2012</b>" ou só "<b> 2024</b>" quando o site não tem marca e modelo.
  const label = /height: 40px;">\s*<b>([^<]*)<\/b>/.exec(block)?.[1];
  const labelText = label === undefined ? "" : decodeHtmlEntities(label).replace(/\s+/g, " ").trim();
  const labelParts = /^(.*?)\s*\b((?:19|20)\d{2})$/.exec(labelText);
  const vehicle = nonEmpty(labelParts ? (labelParts[1] ?? "") : labelText);
  const year = labelParts?.[2] ? Number(labelParts[2]) : null;
  const value = new RegExp(`id="valor_atual_lote_${lotId}">\\s*([^<]+?)\\s*<`).exec(block)?.[1] ?? null;
  const photo = /<img src="([^"]+\/img_\d+_\d+\.jpe?g)"/i.exec(block)?.[1] ?? null;
  return {
    lotId,
    lotNumber,
    condition: condition === null ? null : nonEmpty(condition),
    vehicle,
    year,
    value: value === null ? null : nonEmpty(value),
    photo: photo === null ? null : absoluteUrl(photo),
  };
}

/** Ficha do lote ("Informações Adicionais") e fotos. Lote encerrado perde fotos e anos (o site mostra "-"). */
const pageSchema = z.object({ fields: z.record(z.string(), z.string()), photos: z.array(z.string()) });
export type DetranPage = z.infer<typeof pageSchema>;

export function parseDetranLotPage(html: string): DetranPage | null {
  if (!/Detalhes do lote/i.test(html)) return null;
  const fields: Record<string, string> = {};
  for (const match of html.matchAll(/<dt[^>]*>\s*([^<:]+?)\s*:?\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)) {
    const label = match[1];
    const value = htmlToLines(match[2] ?? "").join(" ");
    if (label && value !== "" && value !== "-") fields[normalizePlaceName(decodeHtmlEntities(label))] = value;
  }
  const photos = new Set<string>();
  for (const match of html.matchAll(/<img src="([^"]+\/img_\d+_\d+\.jpe?g)"/gi)) {
    if (match[1]) photos.add(absoluteUrl(match[1]));
  }
  return { fields, photos: [...photos] };
}

/** Situação de vários lotes. Erro do site (`{"error": true}`) ou formato desconhecido viram `missing_data`. */
export function parseDetranLive(json: string): Result<Map<string, DetranLiveLot>, ParseError> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return err("missing_data");
  }
  const response = detranLiveResponseSchema.safeParse(data);
  if (!response.success || response.data.error === true) return err("missing_data");
  const lots = new Map<string, DetranLiveLot>();
  for (const [id, value] of Object.entries(response.data)) {
    const lot = detranLiveLotSchema.safeParse(value);
    if (!lot.success) return err("invalid_data");
    lots.set(id, lot.data);
  }
  return ok(lots);
}

/**
 * Dado bruto guardado em `listings.raw`. A revisita depois do fim parte dele: a lista do leilão sai do ar e a página do
 * lote perde fotos e anos, então só a situação é lida de novo (o coletor entrega o dado guardado, D-48).
 */
const liveSnapshotSchema = z.object({
  status: z.string(),
  value: z.string().nullable(),
  increment: z.string().nullable(),
  /** Há arrematante (o site só mostra o documento mascarado; não guardamos nem isso). */
  hasWinner: z.boolean(),
  /** Fim calculado pelo tempo restante na última leitura com o lote aberto. */
  endsAt: z.iso.datetime().nullable(),
});
type LiveSnapshot = z.infer<typeof liveSnapshotSchema>;

export const detranRawSchema = z.object({
  lotId: z.string(),
  auction: auctionSchema,
  card: cardSchema.nullable(),
  page: pageSchema.nullable(),
  live: liveSnapshotSchema,
});
export type DetranRaw = z.infer<typeof detranRawSchema>;

export function readDetranRaw(raw: unknown): DetranRaw | null {
  const parsed = detranRawSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Retrato da consulta de situação. O fim só muda com o lote aberto; depois, vale o da última leitura. */
export function snapshotLive(live: DetranLiveLot, previous: LiveSnapshot | null, now: Date): LiveSnapshot {
  const open = OPEN_STATUSES.has(live.status);
  const endsAt =
    open && typeof live.tempo === "number"
      ? // Arredonda ao minuto: o tempo restante muda a cada segundo e geraria um fim novo a cada leitura.
        new Date(Math.round((now.getTime() + Math.max(0, live.tempo) * 1000) / 60_000) * 60_000).toISOString()
      : (previous?.endsAt ?? null);
  return {
    status: live.status,
    value: live.valor ?? null,
    increment: live.valorIncremento ?? previous?.increment ?? null,
    hasWinner: typeof live.arrematante === "string" && live.arrematante.trim() !== "",
    endsAt,
  };
}

const OPEN_STATUSES = new Set(["1", "2"]);
const ENDED_STATUSES = new Set(["3", "5"]);

/**
 * 1 e 2 em andamento; 3 e 5 encerrado (vendido se há valor e arrematante; sem lance quando o valor some); 4
 * cancelado. Confirmado em 09/10/2026 com lotes antigos (fixture `situacao.json`). Situação desconhecida segue
 * aberta até o fim e depois fica desconhecida, como nas outras fontes.
 */
function mapStatus(live: LiveSnapshot, now: Date): ListingStatus {
  if (OPEN_STATUSES.has(live.status)) return "open";
  if (live.status === "4") return "withdrawn";
  if (ENDED_STATUSES.has(live.status)) {
    if (live.value === null) return "unsold";
    return live.hasWinner ? "sold" : "unknown";
  }
  const endsAt = live.endsAt === null ? null : new Date(live.endsAt);
  return endsAt !== null && endsAt.getTime() > now.getTime() ? "open" : "unknown";
}

export function buildDetranListing(raw: DetranRaw, now: Date): ListingInput {
  const { lotId, auction, card, page, live } = raw;
  const field = (name: string) => page?.fields[name] ?? null;
  const vehicleText = field("MARCA/MODELO") ?? card?.vehicle ?? null;
  const { brand, model } = splitDetranVehicle(vehicleText);
  const modelYear = toYear(field("ANO DO MODELO")) ?? card?.year ?? null;
  const conditionText = field("CONDICAO") ?? card?.condition ?? null;
  const initialValue = money(field("VALOR INICIAL")) ?? money(card?.value);
  const status = mapStatus(live, now);
  const currentBid = live.hasWinner ? money(live.value) : null;
  const photos = page?.photos.length ? page.photos : card?.photo ? [card.photo] : [];

  return {
    externalId: detranExternalId(auction.id, lotId),
    url: detranLotUrl(lotId),
    lotNumber: card?.lotNumber ?? null,
    title: titleOf(vehicleText, card?.lotNumber ?? null),
    vehicle: {
      brand,
      model,
      fipeCode: null,
      fipeName: null,
      modelYear,
      manufactureYear: toYear(field("ANO DE FABRICACAO")),
      mileageKm: null,
      fuel: field("COMBUSTIVEL"),
      color: field("COR"),
      category: categoryOfVehicle(brand, model),
      recoveryType: null,
      hasKey: null,
    },
    auction: {
      externalId: auction.id,
      name: auction.number === null ? null : `Leilão ${auction.number}${auction.city ? ` - ${auction.city}` : ""}`,
      startsAt: null,
    },
    sellerName: "DETRAN/MG",
    description: conditionText === null ? null : `Condição: ${conditionText}`,
    condition: conditionOf(conditionText),
    startsAt: null,
    endsAt: live.endsAt === null ? null : new Date(live.endsAt),
    location: { yardName: auction.yard, city: auction.city, state: auction.city === null ? null : "MG", address: null },
    status,
    sourceStatus: live.status,
    currentBid,
    minimumBid: initialValue,
    bidCount: null,
    marketValue: null,
    // Venda do Estado, paga por DAE: o edital não cobra comissão de leiloeiro nem taxas além do lance.
    costs: {
      commissionRate: null,
      dispatcherFee: null,
      removalFee: null,
      storageFee: null,
      inspectionFee: null,
      otherFees: null,
    },
    photoUrls: photos.filter((url) => url.startsWith(`${DETRAN_MG_IMAGE_ORIGIN}/`)),
    raw,
  };
}

export function detranDetailsFromRaw(raw: unknown, now: Date): ListingDetails | null {
  const parsed = readDetranRaw(raw);
  if (!parsed) return null;
  const conditionText = parsed.page?.fields.CONDICAO ?? parsed.card?.condition ?? null;
  return {
    description: conditionText === null ? null : `Condição: ${conditionText}`,
    condition: conditionOf(conditionText),
    status: mapStatus(parsed.live, now),
    sourceStatus: parsed.live.status,
  };
}

/** "SUCATA" é veículo para desmonte (sem volta à circulação); "CONSERVADO" não declara dano. */
function conditionOf(text: string | null): ListingCondition {
  return text !== null && /SUCATA/i.test(text) ? { ...EMPTY_CONDITION, damageLevel: "salvage" } : EMPTY_CONDITION;
}

/** Sem o ano: o cartão já o mostra ao lado do título. */
function titleOf(vehicle: string | null, lotNumber: string | null): string {
  return vehicle ?? `Veículo sem marca e modelo informados${lotNumber ? ` (lote ${lotNumber})` : ""}`;
}

/** Marcas só de motos (e ciclomotores) vistas no site e no mercado. */
const MOTO_BRANDS = new Set([
  "YAMAHA",
  "DAFRA",
  "SHINERAY",
  "SUNDOWN",
  "KASINSKI",
  "TRAXX",
  "HAOJUE",
  "JTZ",
  "IROS",
  "FASPIDER",
  "GARINNI",
  "WUYANG",
  "BRAVAX",
  "CHARMING",
  "KAWASAKI",
  "HARLEY-DAVIDSON",
  "TRIUMPH",
  "DUCATI",
  "KTM",
  "MOTTU",
  "AVELLOZ",
  "CICLOMOTOR",
  "MVK",
  "AMAZONAS",
  "HYOSUNG",
]);
const CAR_BRANDS = new Set([
  "VW",
  "VOLKSWAGEN",
  "GM",
  "CHEVROLET",
  "FIAT",
  "FORD",
  "RENAULT",
  "PEUGEOT",
  "CITROEN",
  "TOYOTA",
  "HYUNDAI",
  "KIA",
  "NISSAN",
  "MITSUBISHI",
  "JEEP",
  "CHERY",
  "JAC",
  "LR",
  "LAND ROVER",
  "AUDI",
  "SSANGYONG",
  "SUBARU",
  "DODGE",
  "BYD",
  "GWM",
  "MINI",
  "TROLLER",
  "MERCEDES-BENZ",
  "BMW",
  "HAFEI",
]);
/** Modelos de carro das marcas que vendem mais motos (Honda, Suzuki). */
const HONDA_CARS = /^(CIVIC|CITY|FIT|HR-?V|WR-?V|CR-?V|ACCORD|ODYSSEY|ZR-?V)\b/;
const SUZUKI_CARS = /^(VITARA|GRAND|JIMNY|SWIFT|SX4|S-CROSS|BALENO|IGNIS|SAMURAI)\b/;
const BMW_MOTOS = /^[GFRSK] ?\d{3,4}\b/;
const UTILITY_MODELS =
  /^(KOMBI|SAVEIRO|STRADA|MONTANA|S10|HILUX|RANGER|FIORINO|DOBLO|TORO|AMAROK|FRONTIER|L200|D ?10|D ?20|F ?1000|F ?250|COURIER|PAMPA|SPRINTER|MASTER|DUCATO|TRAFIC|EXPERT|JUMPER|BOXER|HR|BONGO|OROCH|TOWNER|RUIYI|MAVERICK|SILVERADO|C ?10|C ?20|A ?10|A ?20)\b/;
/** Caminhões e ônibus das marcas de carro: "CARGO", "F 4000", "D 60", "8.150", "L 1113", "ATEGO", "12000". */
const HEAVY_MODELS =
  /^(CARGO|F ?[4-9]000|F ?1[1-4]000|D ?[4-9]0|\d{1,2}\.\d{3}|\d{4,5}|L ?\d{4}|LS ?\d{4}|LO|OF|ATEGO|ACCELO|AXOR|ACTROS)\b/;

/**
 * Categoria pela marca e modelo: o site só diz o tipo (automóvel, motocicleta…) num filtro que exige sessão. Na
 * dúvida fica `null`, nunca adivinhada (reboques, artesanais, marcas desconhecidas).
 */
export function categoryOfVehicle(brand: string | null, model: string | null): ListingCategory | null {
  if (brand === null) return null;
  const name = model ?? "";
  if (brand === "SCANIA" || brand === "IVECO") return "Pesados";
  if (MOTO_BRANDS.has(brand)) return "Motos";
  if (brand === "HONDA") return HONDA_CARS.test(name) ? "Carros" : "Motos";
  if (brand === "SUZUKI") return SUZUKI_CARS.test(name) ? "Carros" : "Motos";
  if (brand === "BMW" && BMW_MOTOS.test(name)) return "Motos";
  if (!CAR_BRANDS.has(brand)) return null;
  if (HEAVY_MODELS.test(name)) return "Pesados";
  return UTILITY_MODELS.test(name) ? "Utilitarios" : "Carros";
}

const CPF_OR_CNPJ =
  /\s*\b(?:CPF|CNPJ)?\s*:?\s*(?:\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/gi;

/** Apaga CPF e CNPJ (com ou sem o rótulo) do nome do pátio. */
export function redactPersonalIds(text: string): string {
  return text.replace(CPF_OR_CNPJ, "").replace(/\s+/g, " ").trim();
}

function absoluteUrl(path: string): string {
  // O site escreve "/../Imagens/…"; o navegador resolve para "/Imagens/…".
  return `${DETRAN_MG_BASE_URL}/${path.replace(/^(\.\.\/|\/)+/, "").replace(/^(\.\.\/)+/, "")}`;
}

function money(text: string | null | undefined): Cents | null {
  if (!text) return null;
  // "R$ 1.500,00" na página; "1500.00" na consulta interna.
  if (/^\d+(\.\d{1,2})?$/.test(text.trim())) return parseBRL(text.trim().replace(".", ","));
  return parseBRL(text.replace(/R\$\s*/i, ""));
}

function toYear(text: string | null): number | null {
  const year = text === null ? Number.NaN : Number(text);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
}

function nonEmpty(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}
