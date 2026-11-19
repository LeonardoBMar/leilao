import { cleanDescription, normalizeNotes, parseConditionNotes } from "@/domain/listings/condition";
import { fuelOf } from "@/domain/listings/criteria";
import { normalizePlaceName, stateCode } from "@/domain/listings/place";
import type { ListingCategory, ListingInput, ListingStatus } from "@/domain/listings/types";
import { bps, type Cents, parseBRL } from "@/domain/money";
import { formatDate } from "@/lib/format";

import { LEILAO_ONLINE_IMAGE_ORIGIN } from "../image-origins";
import { decodeHtmlEntities, htmlToLines, parseBrasiliaDateTime } from "../shared/extract";
import { redactVehicleIds } from "../shared/redact";
import type { ListingDetails } from "../types";
import { type LeilaoOnlineRaw, leilaoOnlineRawSchema } from "./schema";

export const LEILAO_ONLINE_BASE_URL = "https://www.leilaoonline.com.br";
export const LEILAO_ONLINE_NAME = "Leilão Online";

/** Leilões abertos da categoria "Automóveis" (carros, motos e caminhões). */
export const LEILAO_ONLINE_CATEGORY_URL = `${LEILAO_ONLINE_BASE_URL}/leilao/LeilaoPorCategoria/1/leilao-carros`;

/** Anúncio = lote, pelo id do site (`/lote/detalhe/{id}`), que não muda de leilão. */
export const leilaoOnlineListingUrl = (lotId: string) => `${LEILAO_ONLINE_BASE_URL}/lote/detalhe/${lotId}`;

/** Lista de lotes do leilão, 20 por página, opcionalmente só uma categoria do filtro do site. */
export function leilaoOnlineAuctionUrl(auctionId: string, page: number, categoryId: string | null = null): string {
  const filter = categoryId === null ? "" : `&categoria=${encodeURIComponent(categoryId)}`;
  return `${LEILAO_ONLINE_BASE_URL}/leilao/detalhe/${auctionId}/${page}?flow=1${filter}`;
}

/**
 * Situação do lote (`#statusLote`), conferida em páginas reais em 09/10/2026: 1 "Aguardando", 3 "Vendido", 4 "Venda
 * condicional" (logo depois do pregão, à espera do comitente por até 5 dias úteis), 5 "Não vendido". O 2 não apareceu;
 * a própria tela trata tudo abaixo de 3 como aberto (mostra o contador). O resto não é adivinhado.
 */
const STATUS_BY_CODE: Record<number, ListingStatus> = {
  1: "open",
  2: "open",
  3: "sold",
  4: "conditional",
  5: "unsold",
};

/**
 * Categorias do filtro da lista do leilão (nome normalizado) → vocabulário comum (D-37). Vistas em 09/10/2026: Carros,
 * Motos, Caminhões e Diversos. "Diversos" e nomes novos ficam sem.
 */
const CATEGORY_BY_NAME: Record<string, ListingCategory> = {
  CARROS: "Carros",
  MOTOS: "Motos",
  CAMINHOES: "Pesados",
};

/** Comissão do leiloeiro: 5% sobre o arremate, pelos Termos de Uso do site (`/termos-de-uso`). */
const COMMISSION_BPS = 500;

/**
 * Ids dos leilões listados na página da categoria, na ordem do site, sem repetir. `null`: nenhum leilão e sem o aviso
 * de categoria vazia do site, ou seja, a página mudou; nunca "nenhum leilão aberto" sem conferir.
 */
export function parseLeilaoOnlineCategory(html: string): string[] | null {
  const ids = unique([...html.matchAll(/\/leilao\/detalhe\/(\d+)/g)].map(([, id]) => id ?? ""));
  if (ids.length > 0) return ids;
  return /N(?:ã|&atilde;)o existem leil(?:õ|&otilde;)es em andamento/i.test(html) ? [] : null;
}

export type LeilaoOnlineAuctionPage = {
  lotIds: string[];
  /** Maior página citada na paginação (a página além da última repete a última, então o limite vem daqui). */
  lastPage: number;
  /** Opções do filtro "Categoria" do leilão: id do site e nome ("Carros", "Caminhões", "Diversos"). */
  categories: { id: string; name: string }[];
};

/**
 * Página da lista de lotes de um leilão. `null`: não é a página deste leilão (o site redireciona o leilão inexistente
 * para a lista geral).
 */
export function parseLeilaoOnlineAuctionPage(html: string, auctionId: string): LeilaoOnlineAuctionPage | null {
  if (!new RegExp(`id="leilaoId" value="${auctionId}"`).test(html)) return null;
  const lotsAt = html.indexOf('id="lotes"');
  const lots = lotsAt < 0 ? "" : html.slice(lotsAt);
  const pages = [...html.matchAll(new RegExp(`/leilao/detalhe/${auctionId}/(\\d+)`, "g"))].map(([, n]) => Number(n));
  const select = /<select name="categoria"[\s\S]*?<\/select>/.exec(html)?.[0] ?? "";
  return {
    lotIds: unique([...lots.matchAll(/\/lote\/detalhe\/(\d+)/g)].map(([, id]) => id ?? "")),
    lastPage: Math.max(1, ...pages),
    categories: [...select.matchAll(/<option value="(\d+)">([^<]*)</g)].map(([, id, name]) => ({
      id: id ?? "",
      name: plain(name ?? ""),
    })),
  };
}

/** O que a página do lote diz dele (o dado bruto sem a categoria, que vem da lista do leilão). */
export type LeilaoOnlineLotPage = Omit<LeilaoOnlineRaw, "category">;

/** A página é de um lote. O lote inexistente redireciona para a página inicial, que não tem o campo. */
export function isLeilaoOnlineLotPage(html: string): boolean {
  return /id="loteId" value="\d+"/.test(html);
}

/** Lê a página do lote. `null`: falta lote, leilão ou título (não é página de lote, ou o formato mudou). */
export function parseLeilaoOnlineLotPage(html: string): LeilaoOnlineLotPage | null {
  const lotId = /id="loteId" value="(\d+)"/.exec(html)?.[1];
  const auctionId = /id="leilaoId" value="(\d+)"/.exec(html)?.[1];
  const heading = /<h4 class="no-margin-top m-l-15">([^<]*)<\/h4>/.exec(html)?.[1];
  if (!lotId || !auctionId || heading === undefined) return null;

  const statusCode = Number(/id="statusLote" value="(\d+)"/.exec(html)?.[1]);
  const bidCount = Number(/Lances<br>\s*<strong>(\d+)<\/strong>/.exec(html)?.[1]);
  const lastBid = plain(/class="lance-atual">\s*R\$\s*([^<]*)</.exec(html)?.[1] ?? "");
  return {
    lotId,
    auctionId,
    lotNumber: nonEmpty(plain(/<h1>\s*Lote\s+([^<]*)<\/h1>/.exec(html)?.[1] ?? "")),
    // Placa, chassi e Renavam saem já aqui (título e especificações): nem o `raw` os guarda (D-40).
    title: redactVehicleIds(plain(heading).replace(/^veja o v[ií]deo!+\s*/i, "")),
    specs: specsOf(html),
    statusCode: Number.isInteger(statusCode) ? statusCode : null,
    statusText: nonEmpty(plain(/class="status-lote[^"]*">([^<]*)</.exec(html)?.[1] ?? "")),
    auctionAt:
      /data-data-pregao="([^"]+)"/.exec(html)?.[1] ?? /id="dataPregao" value="([^"]+)"/.exec(html)?.[1] ?? null,
    minimumBid: /Lance inicial<br>\s*R\$\s*<strong>([\d.,]+)<\/strong>/.exec(html)?.[1] ?? null,
    lastBid: /\d/.test(lastBid) ? lastBid : null,
    bidCount: Number.isInteger(bidCount) ? bidCount : null,
    lastBidAt: lastBidAtOf(html),
    photos: photosOf(html, lotId),
  };
}

/**
 * Especificações do lote: o primeiro parágrafo depois do título. O segundo é o aviso padrão do leiloeiro ("VALOR
 * INICIAL, NÃO CORRESPONDE…", "FRAUDAR LEILÃO É CRIME"), igual em todos os lotes, e fica de fora.
 */
function specsOf(html: string): string | null {
  const block = /class="descricao-leilao">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
  const own = block.split(/<p\b/i)[0] ?? "";
  return nonEmpty(redactVehicleIds(htmlToLines(own).join(" ")));
}

/** Data da primeira linha da tabela de lances (a mais recente). As outras colunas (apelido) não são lidas. */
function lastBidAtOf(html: string): string | null {
  const at = html.indexOf("ultimos-lances-table");
  if (at < 0) return null;
  const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(html.slice(at))?.[1] ?? "";
  return /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})/.exec(body)?.[1] ?? null;
}

/**
 * Fotos do lote no CloudFront do site (`/img/leiloes/{leilão}/lotes/{lote}/…`), na ordem da galeria, sem repetir.
 * Os nomes têm espaço e parênteses ("4 (1).jpg"): a URL é codificada.
 */
function photosOf(html: string, lotId: string): string[] {
  const pattern = new RegExp(
    `href="(${escapeRegExp(LEILAO_ONLINE_IMAGE_ORIGIN)}/img/leiloes/\\d+/lotes/${lotId}/[^"]+)"`,
    "g",
  );
  return unique([...html.matchAll(pattern)].map(([, url]) => encodeURI(decodeHtmlEntities(url ?? ""))));
}

/** Categoria do filtro do site no vocabulário comum; "Diversos" e nomes novos ficam sem (nunca adivinhado). */
export function categoryOfName(name: string): ListingCategory | null {
  return CATEGORY_BY_NAME[normalizePlaceName(name)] ?? null;
}

/** Dado bruto (página + categoria da lista) → anúncio no formato único. */
export function buildLeilaoOnlineListing(raw: LeilaoOnlineRaw, now: Date): ListingInput {
  const vehicle = parseLeilaoOnlineTitle(raw.title, now);
  const auctionAt = raw.auctionAt === null ? null : siteDateTime(raw.auctionAt);
  const status = mapStatus(raw.statusCode, auctionAt, now);
  const currentBid = raw.lastBid === null ? null : money(raw.lastBid);

  return {
    externalId: raw.lotId,
    url: leilaoOnlineListingUrl(raw.lotId),
    lotNumber: raw.lotNumber,
    title: vehicle.name || "Lote sem descrição",
    vehicle: {
      brand: vehicle.brand,
      model: vehicle.model,
      fipeCode: null,
      fipeName: null,
      modelYear: vehicle.modelYear,
      manufactureYear: vehicle.manufactureYear,
      mileageKm: vehicle.mileageKm,
      fuel: vehicle.fuel,
      color: vehicle.color,
      category: raw.category === null ? null : categoryOfName(raw.category.name),
      recoveryType: null,
      hasKey: keyOf(describe(raw)),
    },
    auction: {
      externalId: raw.auctionId,
      // A página não traz o nome do leilão; o dia identifica o evento para o usuário.
      name: auctionAt === null ? `Leilão ${raw.auctionId}` : `Leilão de ${formatDate(auctionAt)}`,
      startsAt: auctionAt,
    },
    sellerName: sellerOf(raw.specs),
    description: describe(raw),
    condition: conditionOf(raw),
    startsAt: null,
    endsAt: endOf(raw, status, auctionAt),
    location: placeOf(raw.specs),
    status,
    sourceStatus: raw.statusText,
    currentBid: raw.bidCount === 0 ? null : currentBid,
    minimumBid: raw.minimumBid === null ? null : money(raw.minimumBid),
    bidCount: raw.bidCount,
    marketValue: vehicle.marketValue,
    costs: {
      commissionRate: bps(COMMISSION_BPS),
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
export function leilaoOnlineDetailsFromRaw(raw: unknown, now: Date): ListingDetails | null {
  const parsed = readLeilaoOnlineRaw(raw);
  if (!parsed) return null;
  const auctionAt = parsed.auctionAt === null ? null : siteDateTime(parsed.auctionAt);
  return {
    description: describe(parsed),
    condition: conditionOf(parsed),
    status: mapStatus(parsed.statusCode, auctionAt, now),
    sourceStatus: parsed.statusText,
  };
}

export function readLeilaoOnlineRaw(raw: unknown): LeilaoOnlineRaw | null {
  const parsed = leilaoOnlineRawSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function mapStatus(code: number | null, auctionAt: Date | null, now: Date): ListingStatus {
  const known = code === null ? undefined : STATUS_BY_CODE[code];
  if (known) return known;
  return auctionAt !== null && auctionAt < now ? "unknown" : "open";
}

/**
 * Os lotes são apregoados em sequência a partir da hora do leilão, e a página não diz quando cada um fecha. Aberto:
 * a hora do leilão. Encerrado com lance: a hora do último lance, que fica a no máximo 2 min do fechamento (prorrogação).
 */
function endOf(raw: LeilaoOnlineRaw, status: ListingStatus, auctionAt: Date | null): Date | null {
  if (status === "open" || raw.lastBidAt === null) return auctionAt;
  const lastBidAt = siteDateTime(raw.lastBidAt);
  if (lastBidAt === null || (auctionAt !== null && lastBidAt < auctionAt)) return auctionAt;
  return lastBidAt;
}

/** Notas do título ("FUNCIONANDO - IPVA 2026 OK") e especificações do lote, sem placa, chassi e Renavam. */
function describe(raw: Pick<LeilaoOnlineRaw, "title" | "specs">): string | null {
  const notes = titleNotes(raw.title);
  const parts = [notes, raw.specs ?? ""].filter((part) => part !== "");
  return cleanDescription(redactVehicleIds(parts.join("\n")));
}

/** Monta, sucata e marcações citadas no título ou nas especificações ("SINISTRO MÉDIA MONTA", "SUCATA…"). */
function conditionOf(raw: Pick<LeilaoOnlineRaw, "title" | "specs">): ListingInput["condition"] {
  return { ...parseConditionNotes(describe(raw)), inspection: null, inspectionNotes: null };
}

/** "LOCALIZAÇÃO PARA RETIRADA EM SÃO PAULO/SP." Sem a frase, local desconhecido (nunca adivinhado). */
function placeOf(specs: string | null): ListingInput["location"] {
  const match = /RETIRADA EM\s+([^/;,.]+?)\s*\/\s*([A-Za-z]{2})\b/i.exec(specs ?? "");
  const state = match?.[2] ? stateCode(match[2]) : null;
  const city = match?.[1]?.trim() ?? null;
  return city && state
    ? { yardName: null, city, state, address: null }
    : { yardName: null, city: null, state: null, address: null };
}

/** "COMITENTE: P. FÍSICA" nas especificações; o nome do leilão na lista é descrição do evento, não o vendedor. */
function sellerOf(specs: string | null): string | null {
  return nonEmpty(/COMITENTE:\s*([^-;]+?)\s*(?:\s-\s|;|$)/i.exec(specs ?? "")?.[1] ?? "");
}

function keyOf(description: string | null): boolean | null {
  const text = normalizeNotes(description ?? "");
  if (/\bSEM CHAVES?\b/.test(text)) return false;
  if (/\bCOM CHAVES?\b/.test(text)) return true;
  return null;
}

export type LeilaoOnlineVehicle = {
  /** Marca e modelo como o site escreve ("TOYOTA/ETIOS HB X 13L MT"), sem anos e notas. */
  name: string;
  brand: string | null;
  model: string | null;
  manufactureYear: number | null;
  modelYear: number | null;
  color: string | null;
  fuel: string | null;
  mileageKm: number | null;
  marketValue: Cents | null;
};

/**
 * Título do lote: "MARCA/MODELO; fab/modelo; COR; COMBUSTÍVEL[; extras] - NOTA - NOTA…". Notas trazem "APROX. 9.850KM" e
 * "FIPE APROX.: R$ 72.052,00". Moto sem ano de fabricação: "BMW K1200 LT; ANO 2002 - …". Caminhão: "CAMINHÃO VOLVO/…;
 * ANO 2002/2003; COR BRANCA; COMB. DIESEL", às vezes sem a cor ("…; ANO 2014/2015; DIESEL; AUTOMÁTICO").
 */
export function parseLeilaoOnlineTitle(title: string, now: Date): LeilaoOnlineVehicle {
  const [head = ""] = title.split(NOTE_SEPARATOR);
  const parts = head.split(";").map((part) => part.trim());
  const name = parts[0] ?? "";
  const yearsAt = parts.findIndex((part) => /^(?:ANO\s+)?\d{4}(?:\/\d{4})?$/i.test(part));
  const years = yearsAt < 0 ? [] : (parts[yearsAt]?.replace(/^ANO\s+/i, "").split("/") ?? []);
  const notes = normalizeNotes(title);
  const mileage = /\bAPROX\.?\s*([\d.]+)\s*KM\b/.exec(notes)?.[1];
  const fipe = /\bFIPE APROX\.?:?\s*R\$\s*([\d.]+,\d{2})/.exec(notes)?.[1];
  return {
    name,
    ...splitBrandModel(name),
    manufactureYear: toYear(years[0], now),
    modelYear: toYear(years[1] ?? years[0], now),
    ...colorAndFuel(yearsAt < 0 ? [] : parts.slice(yearsAt + 1)),
    mileageKm: mileage ? Number(mileage.replace(/\./g, "")) : null,
    marketValue: fipe ? money(fipe) : null,
  };
}

/** Entre o título e as notas o site usa hífen ou travessão: "… DIESEL – FUNCIONANDO – IPVA 2026 OK". */
const NOTE_SEPARATOR = /\s+[-–]\s+/;

/**
 * Cor e combustível depois do ano. Com rótulo ("COR BRANCA", "COMB. DIESEL") vale o rótulo; sem, a cor vem antes do
 * combustível, e uma parte que já é combustível ("DIESEL") encerra a busca pela cor. Extras ("AUTOMÁTICO") ficam fora.
 */
function colorAndFuel(parts: readonly string[]): { color: string | null; fuel: string | null } {
  let color: string | null = null;
  let fuel: string | null = null;
  for (const part of parts) {
    const labeledColor = /^COR\s+(.+)$/i.exec(part)?.[1];
    const labeledFuel = /^COMB\.?\s+(.+)$/i.exec(part)?.[1];
    if (labeledColor) color ??= labeledColor;
    else if (labeledFuel) fuel ??= labeledFuel;
    else if (fuel === null && fuelOf(part) !== null) fuel = part;
    // Cor sem rótulo é só palavra ("PRATA", "AZUL MARINHO"); "C/ CARROCERIA" e "3 EIXOS" são extras.
    else if (fuel === null && color === null && /^\p{L}+(?: \p{L}+)*$/u.test(part)) color = part;
  }
  return { color: color === null ? null : nonEmpty(color), fuel: fuel === null ? null : nonEmpty(fuel) };
}

/** Tudo depois do primeiro separador do título: estado e destaques ("FUNCIONANDO - IPVA 2026 OK"). */
function titleNotes(title: string): string {
  return title.split(NOTE_SEPARATOR).slice(1).join(" - ").trim();
}

/** Tipo do veículo antes da marca ("CAMINHÃO PIPA M. BENZ/LK 1513", "MOTO JTZ/DK160"): não é marca. */
const VEHICLE_TYPE =
  /^(?:CAMINH[AÃ]O|CAMINHONETE|MOTO(?:CICLETA)?|[OÔ]NIBUS|MICRO[- ]?[OÔ]NIBUS)(?:\s+(?:PIPA|BA[UÚ]|TOCO|TRUCK|TRUCKADO|TRUCADO|GUINCHO|MUNCK|TRATOR|CA[CÇ]AMBA|BASCULANTE|PLATAFORMA|TANQUE))*\s+/i;
/** Prefixo de importado antes da barra ("I/FORD FOCUS", "IMP/VW GOLF"): a marca é a palavra seguinte. */
const IMPORTED = new Set(["I", "IMP"]);
const BRAND_NAMES: Readonly<Record<string, string>> = {
  CHEV: "CHEVROLET",
  MMC: "MITSUBISHI",
  "M. BENZ": "MERCEDES-BENZ",
  "M.BENZ": "MERCEDES-BENZ",
  MBENZ: "MERCEDES-BENZ",
  "M BENZ": "MERCEDES-BENZ",
  LR: "LAND ROVER",
};

/** "VW/FOX 1.0" → VW + FOX 1.0; "I/FORD FOCUS 1.6" → FORD + FOCUS 1.6; "FIAT UNO MILLE" → FIAT + UNO MILLE. */
export function splitBrandModel(name: string): { brand: string | null; model: string | null } {
  const clean = name.replace(VEHICLE_TYPE, "").replace(/\s+/g, " ").trim().toUpperCase();
  const slash = clean.indexOf("/");
  const prefix = slash < 0 ? null : clean.slice(0, slash).trim();
  const rest = slash < 0 ? clean : clean.slice(slash + 1).trim();
  if (prefix !== null && !IMPORTED.has(prefix)) return { brand: brandName(prefix), model: nonEmpty(rest) };
  // Sem barra (ou depois do prefixo de importado), a marca é a primeira palavra.
  const [first = "", ...others] = rest.split(" ");
  return { brand: brandName(first), model: nonEmpty(others.join(" ")) };
}

function brandName(brand: string): string | null {
  return nonEmpty(BRAND_NAMES[brand] ?? brand);
}

function toYear(value: string | undefined, now: Date): number | null {
  if (value === undefined || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 1900 && year <= now.getUTCFullYear() + 1 ? year : null;
}

/** "2026-10-14 15:00:00" ou "06/10/2026 15:31:25", em horário de Brasília → instante UTC. */
function siteDateTime(text: string): Date | null {
  return parseBrasiliaDateTime(text);
}

function money(text: string): Cents | null {
  const value = parseBRL(text.replace(/[^\d.,]/g, ""));
  return value !== null && value > 0 ? value : null;
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
