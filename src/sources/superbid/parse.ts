import { z } from "zod";

import { EMPTY_CONDITION, type ListingCondition, parseConditionNotes, worstDamage } from "@/domain/listings/condition";
import { stateCode } from "@/domain/listings/place";
import type { ListingCategory, ListingInput, ListingStatus } from "@/domain/listings/types";
import { bps, type Cents } from "@/domain/money";
import { err, ok, type Result } from "@/lib/result";

import { SUPERBID_IMAGE_ORIGIN } from "../image-origins";
import { splitDetranVehicle } from "../shared/detran-vehicle";
import { htmlToLines, reaisToCents } from "../shared/extract";
import { redactVehicleIds } from "../shared/redact";
import { categoryOfVehicle, isKnownVehicleBrand } from "../shared/vehicle-category";
import type { ListingDetails, ParseError } from "../types";
import { superbidListedOfferSchema, superbidListSchema, type SuperbidOffer, superbidOfferSchema } from "./schema";

export const SUPERBID_NAME = "Superbid";
export const SUPERBID_BASE_URL = "https://exchange.superbid.net";
const API_URL = "https://offer-query.superbid.net/offers/";

/** Categorias de Carros & Motos na API: as cotas de consórcio, do mesmo tipo de produto, ficam em outra (11806). */
export const SUPERBID_CATEGORY_IDS = { cars: 10000, motorcycles: 10012 } as const;
/** Subcategorias de Carros que o vocabulário comum chama de utilitários: picapes, utilitários e furgões, ambulâncias. */
const UTILITY_SUBCATEGORY_IDS: ReadonlySet<number> = new Set([10005, 10009, 10010]);
/** Gerenciador da equipe técnica do site, que publica leilões de teste ("TESTE RFA", "[DEMO] Pós-leilão"). */
const TEST_MANAGER_ID = 114;

/** Página da descoberta. A API não pagina além de 10 mil resultados (20 páginas): cada categoria fica abaixo disso. */
export const SUPERBID_PAGE_SIZE = 500;
export const SUPERBID_MAX_PAGES = 20;

const PHOTO_PREFIX = `${SUPERBID_IMAGE_ORIGIN}/photos/`;

/** Parâmetros comuns a todas as consultas: portais do Brasil, fuso das datas em texto. */
function apiUrl(params: Record<string, string>): string {
  const query = new URLSearchParams({
    portalId: "[2,15]",
    locale: "pt_BR",
    timeZoneId: "America/Sao_Paulo",
    requestOrigin: "marketplace",
    ...params,
  });
  return `${API_URL}?${query.toString()}`;
}

/**
 * Lotes abertos (`statusId:1`) de leilão (`auction.modalityId:1`, sem tomada de preço) de uma categoria, do mais novo
 * para o mais antigo. `orderBy=id:desc` é a única ordenação que a API respeita; só o necessário vem (`fieldList`).
 */
export const superbidListUrl = (categoryId: number, page: number) =>
  apiUrl({
    filter: `product.productType.id:10;statusId:1;auction.modalityId:1;product.subCategory.category.id:${categoryId}`,
    fieldList: "id;endDateTime;manager",
    orderBy: "id:desc",
    pageNumber: String(page),
    pageSize: String(SUPERBID_PAGE_SIZE),
  });

/** Uma oferta pelo id, em qualquer situação (aberta ou encerrada). */
export const superbidOfferApiUrl = (offerId: string) => apiUrl({ filter: `id:${offerId}` });

export const superbidListingUrl = (externalId: string) => `${SUPERBID_BASE_URL}/oferta/${externalId}`;

export function parseSuperbidExternalId(externalId: string): string | null {
  return /^[1-9]\d{0,11}$/.test(externalId) ? externalId : null;
}

/**
 * Lotes encerrados (vendido, condicional, sem venda, retirado e os de desfecho desconhecido) de leilão de Carros e
 * Motos, do mais novo para o mais antigo: a carga avulsa dos últimos dias (`scripts/superbid-backfill.ts`).
 */
export const superbidClosedListUrl = (page: number) =>
  apiUrl({
    filter:
      "product.productType.id:10;statusId:[3,6,7,11,80];auction.modalityId:1;" +
      `product.subCategory.category.id:[${Object.values(SUPERBID_CATEGORY_IDS).join(",")}]`,
    fieldList: "id;endDateTime;manager",
    orderBy: "id:desc",
    pageNumber: String(page),
    pageSize: String(SUPERBID_PAGE_SIZE),
  });

/** Oferta de uma página de lista, com o fim em milissegundos (`null` se a API não informa). */
export type SuperbidListedOffer = { id: string; endsAt: number | null };

type ListPage = { offers: SuperbidListedOffer[]; total: number; count: number };

/** Ofertas de uma página de lista, sem as dos leilões de teste. */
function parseListPage(json: string): Result<ListPage, ParseError> {
  const list = superbidListSchema.safeParse(parseJson(json));
  if (!list.success) return err("missing_data");
  const offers: SuperbidListedOffer[] = [];
  for (const item of list.data.offers) {
    const offer = superbidListedOfferSchema.safeParse(item);
    if (!offer.success) return err("invalid_data");
    const { id, endDateTime, manager } = offer.data;
    if (manager?.id !== TEST_MANAGER_ID) offers.push({ id: String(id), endsAt: endDateTime ?? null });
  }
  return ok({ offers, total: list.data.total, count: list.data.offers.length });
}

/**
 * Ofertas de uma página da descoberta que ainda vão encerrar. A API mantém como abertos (`statusId:1`) lotes que já
 * passaram do fim, alguns há meses, e o site não os mostra; leilões de teste também ficam de fora.
 */
export function parseSuperbidList(json: string, now: Date): Result<ListPage, ParseError> {
  const page = parseListPage(json);
  if (!page.ok) return page;
  const offers = page.value.offers.filter((offer) => offer.endsAt === null || offer.endsAt > now.getTime());
  return ok({ ...page.value, offers });
}

/**
 * Ofertas de uma página de encerrados que terminaram desde `since`. `older` diz que a página inteira terminou antes:
 * a ordem é por id, não pelo fim, então a busca só para quando uma página toda fica fora da janela.
 */
export function parseSuperbidClosedList(
  json: string,
  since: Date,
): Result<{ ids: string[]; total: number; count: number; older: boolean }, ParseError> {
  const page = parseListPage(json);
  if (!page.ok) return page;
  const recent = (offer: SuperbidListedOffer) => offer.endsAt !== null && offer.endsAt >= since.getTime();
  const ids = page.value.offers.filter(recent).map((offer) => offer.id);
  return ok({ ids, total: page.value.total, count: page.value.count, older: ids.length === 0 });
}

/**
 * Dado bruto guardado em `listings.raw`: a oferta como o site a descreve, sem quem está vencendo (só se há vencedor) e
 * sem telefones do vendedor; placa completa, chassi e Renavam saem do título e da descrição (D-40). Valores em reais.
 */
export const superbidRawSchema = z.object({
  offerId: z.string(),
  lotNumber: z.string().nullable(),
  /** "HONDA HR-V EX HS, 2024/2025, Placa FINAL 3 (SP),". */
  title: z.string(),
  /** Linhas da descrição, sem as de chassi. */
  description: z.array(z.string()),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  categoryId: z.number().nullable(),
  subcategoryId: z.number().nullable(),
  subcategory: z.string().nullable(),
  statusCode: z.number(),
  removed: z.boolean(),
  hasWinner: z.boolean(),
  bidCount: z.number(),
  price: z.number().nullable(),
  initialBid: z.number().nullable(),
  auction: z.object({
    id: z.string(),
    name: z.string().nullable(),
    opensAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
  }),
  endsAt: z.iso.datetime().nullable(),
  location: z.object({ city: z.string().nullable(), state: z.string().nullable(), country: z.string().nullable() }),
  seller: z.string().nullable(),
  commissionPercent: z.number().nullable(),
  fees: z.array(z.object({ name: z.string().nullable(), value: z.number() })),
  photos: z.array(z.string()),
});
export type SuperbidRaw = z.infer<typeof superbidRawSchema>;

export function readSuperbidRaw(raw: unknown): SuperbidRaw | null {
  const parsed = superbidRawSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Resposta da consulta de uma oferta pelo id. `ok(null)`: a API não conhece a oferta. */
export function parseSuperbidOffer(json: string, offerId: string): Result<SuperbidRaw | null, ParseError> {
  const list = superbidListSchema.safeParse(parseJson(json));
  if (!list.success) return err("missing_data");
  const [item] = list.data.offers;
  if (item === undefined) return ok(null);
  const offer = superbidOfferSchema.safeParse(item);
  if (!offer.success) return err("invalid_data");
  if (String(offer.data.id) !== offerId) return err("invalid_data");
  return ok(rawOf(offer.data));
}

function rawOf(offer: SuperbidOffer): SuperbidRaw {
  const { product, auction } = offer;
  const commission = offer.groupOffer?.commissionPercent ?? offer.commercialCondition?.auctioneerCommissionPercent;
  return {
    offerId: String(offer.id),
    lotNumber: offer.lotNumber == null ? null : String(offer.lotNumber),
    title: redactVehicleIds(product.shortDesc.replace(/\s+/g, " ").trim()),
    description: htmlToLines(product.detailedDescription ?? "")
      .filter((line) => !/^CHASSI\b/.test(plainUpper(line)))
      .map((line) => redactVehicleIds(line)),
    brand: nonEmpty(product.brand?.description),
    model: nonEmpty(product.model?.description),
    categoryId: product.subCategory?.category?.id ?? null,
    subcategoryId: product.subCategory?.id ?? null,
    subcategory: nonEmpty(product.subCategory?.description),
    statusCode: offer.offerStatus.statusCode,
    removed: offer.offerStatus.removed === true,
    hasWinner: Object.keys(offer.winnerBid ?? {}).length > 0,
    bidCount: offer.totalBids ?? 0,
    price: offer.price ?? null,
    initialBid: offer.offerDetail?.initialBidValue ?? null,
    auction: {
      id: String(auction.id),
      name: nonEmpty(auction.desc),
      opensAt: localToIso(auction.beginDate),
      endsAt: localToIso(auction.endDate),
    },
    endsAt: offer.endDateTime == null ? null : new Date(offer.endDateTime).toISOString(),
    location: {
      city: nonEmpty(product.location?.city),
      state: nonEmpty(product.location?.state),
      country: nonEmpty(product.location?.country),
    },
    seller: nonEmpty(offer.seller?.company?.[0]?.fantasyName) ?? nonEmpty(offer.store?.name),
    commissionPercent: commission ?? null,
    fees: (offer.paymentItems ?? []).flatMap((item) =>
      item.value == null || item.value <= 0
        ? []
        : [{ name: nonEmpty(item.mapDescriptionTranslator?.pt_BR), value: item.value }],
    ),
    photos: (product.galleryJson ?? []).flatMap((file) =>
      file.type === "photo" && file.link?.startsWith(PHOTO_PREFIX) ? [file.link] : [],
    ),
  };
}

/**
 * Desfecho pelo código de situação da oferta (levantamento de 10/10/2026, docs/PLANO-COLETA.md §2.11). O site mostra
 * "Encerrado" para quase tudo e a flag `sold` não vem nos encerrados, então o código decide:
 * - `1` aberto (inclusive depois do fim, enquanto o site não processa: o coletor revisita);
 * - `3` vencedor com lance na reserva ou acima: vendido;
 * - `7` vencedor com lance abaixo da reserva: condicional (à espera do vendedor);
 * - `6` sem lance: retirado se a oferta saiu do evento (`removed`), senão não vendido.
 * Outros códigos (`11`, `80` e novos) ficam desconhecidos depois do fim; nada é adivinhado.
 */
function mapStatus(raw: SuperbidRaw, now: Date): ListingStatus {
  switch (raw.statusCode) {
    case 1:
      return "open";
    case 3:
      return raw.hasWinner && raw.bidCount > 0 ? "sold" : "unknown";
    case 7:
      return raw.hasWinner ? "conditional" : "unknown";
    case 6:
      if (raw.removed) return "withdrawn";
      return raw.bidCount === 0 ? "unsold" : "unknown";
    default:
      return raw.endsAt !== null && new Date(raw.endsAt).getTime() > now.getTime() ? "open" : "unknown";
  }
}

/** O que a descrição informa em linhas rotuladas ("Marca: HONDA", "Ano Fab/Modelo: 2024/2025", "KM: 41.002"). */
type Labeled = {
  brand: string | null;
  model: string | null;
  /** "VW/VOYAGE 1.6L": marca e modelo no formato do registro. */
  vehicle: string | null;
  /** Par de anos de um rótulo ("Ano Fab/Modelo: 2024/2025", "Ano/Modelo: 2008/2008"). */
  yearPair: Years | null;
  /** "Ano: 2021" sozinho: fabricação quando há "Modelo: 2022", senão o ano do modelo. */
  year: number | null;
  /** "Modelo: 2022" (o ano, não o nome do modelo). */
  modelYear: number | null;
  mileageKm: number | null;
  color: string | null;
  fuel: string | null;
};
type Years = { manufactureYear: number | null; modelYear: number | null };

/**
 * Rótulo e valor; o rótulo pode vir depois de texto na mesma linha ("… 2013/2013 Marca: Land Rover"). "MARCA DO
 * VEÍCULO: FIAT" é a marca, não o veículo: o complemento fica fora do rótulo.
 */
const LABEL =
  /(?:^|\s)(ANO[A-Z ./]*|MARCA|MODELO|VEICULO|QUILOMETRAGEM[A-Z ]*|KM|COR|COMBUSTIVEL)(?: D[OA] VEICULO)?\s*\.?:\s*(.*)$/;

function labeledOf(lines: readonly string[]): Labeled {
  const found: Labeled = {
    brand: null,
    model: null,
    vehicle: null,
    yearPair: null,
    year: null,
    modelYear: null,
    mileageKm: null,
    color: null,
    fuel: null,
  };
  // Algumas descrições trazem a ficha numa linha só, separada por "|".
  for (const line of lines.flatMap((item) => item.split("|"))) {
    const match = LABEL.exec(plainUpper(line));
    const label = match?.[1]?.trim();
    // "Marca: IVECO." — pontuação no fim não é parte do valor.
    const value = nonEmpty(match?.[2]?.replace(/[.;,\s]+$/, ""));
    if (!label || value === null) continue;
    if (label.startsWith("ANO")) {
      const years = yearsOf(value);
      if (years.manufactureYear !== null) found.yearPair ??= years;
      else found.year ??= years.modelYear;
    } else if (label === "MODELO") {
      const year = /^\d{4}$/.test(value) ? toYear(value) : null;
      if (year !== null) found.modelYear ??= year;
      else found.model ??= value;
    } else if (label === "MARCA") found.brand ??= value;
    else if (label === "VEICULO") found.vehicle ??= value;
    else if (label.startsWith("QUILOMETRAGEM") || label === "KM") found.mileageKm ??= mileageOf(value);
    else if (label === "COR") found.color ??= value;
    else if (label === "COMBUSTIVEL") found.fuel ??= value;
  }
  return found;
}

/**
 * Anos do veículo, do mais confiável ao menos: par rotulado; "Ano" e "Modelo" rotulados separados; par do título; ano
 * sozinho (rotulado ou do título), tomado como o do modelo, que é o que a FIPE usa.
 */
function yearsFrom(labeled: Labeled, title: Years): Years {
  if (labeled.yearPair) return labeled.yearPair;
  if (labeled.year !== null && labeled.modelYear !== null)
    return { manufactureYear: labeled.year, modelYear: labeled.modelYear };
  if (title.manufactureYear !== null) return title;
  return { manufactureYear: null, modelYear: labeled.modelYear ?? labeled.year ?? title.modelYear };
}

/** "2024/2025", "2013 2014", "ANO 2014 / MODELO 2015" ou "2019" (ano sozinho fica como o do modelo). */
function yearsOf(text: string): Years {
  const pair =
    /\bANO\b\D{0,4}((?:19|20)\d{2})\D{0,4}\bMODELO\b\D{0,4}((?:19|20)\d{2})\b/.exec(text) ??
    /\b((?:19|20)\d{2})\s*[/ ]\s*((?:19|20)\d{2})\b/.exec(text);
  if (pair) return { manufactureYear: toYear(pair[1]), modelYear: toYear(pair[2]) };
  const single = /\b((?:19|20)\d{2})\b/.exec(text);
  return { manufactureYear: null, modelYear: toYear(single?.[1]) };
}

function mileageOf(text: string): number | null {
  const digits = /\d[\d.]*/.exec(text)?.[0]?.replace(/\./g, "");
  const km = digits === undefined ? Number.NaN : Number(digits);
  return Number.isSafeInteger(km) && km > 0 && km < 2_000_000 ? km : null;
}

/** Marcas de duas palavras que o título escreve com espaço. */
const TWO_WORD_BRANDS = [
  "MERCEDES BENZ",
  "LAND ROVER",
  "CAOA CHERY",
  "ROYAL ENFIELD",
  "HARLEY DAVIDSON",
  "ALFA ROMEO",
  "ASTON MARTIN",
  "GREAT WALL",
];

/** Tipo do veículo que alguns títulos trazem antes da marca; ônibus e caminhão são Pesados no vocabulário comum. */
const TYPE_PREFIX =
  /^(VEICULO|AUTOMOVEL|MOTOCICLETA|MOTONETA|CAMINHONETE|CAMIONETA|UTILITARIO|MICRO-?ONIBUS|ONIBUS|CAMINHAO)(?:\s*[,:/]\s*|\s+)/;
const HEAVY_TYPE = /ONIBUS|CAMINHAO/;
/**
 * O que alguns vendedores escrevem antes da marca: "SUCATA PARA PRENSA:", "BAIXADO NO DETRAN NÃO APTO À CIRCULAÇÃO DE"
 * (depois de "VEÍCULO"), "IMP." (importado), "JTA" (a montadora da Suzuki: "JTA SUZUKI EN125") e o "GM" de
 * "GM CHEVROLET/S10".
 */
const LEADING_NOISE = [
  /^PARA PRENSA\s*[:/]?\s*/,
  /^BAIXADO\b.*?\bCIRCULACAO DE\s+/,
  /^IMP\.?\s+/,
  /^JTA\s+(?=SUZUKI\b)/,
  /^GM\s+(?=CHEVROLET\b)/,
];

type TitleParts = { salvage: boolean; heavy: boolean; brand: string | null; model: string | null; years: Years };

/**
 * Título como o leiloeiro escreve: "HONDA HR-V EX HS, 2024/2025, Placa FINAL 3 (SP)", "HYUNDAI IX35 B 2013 2014 PRETA",
 * "VW/VOYAGE 1.6", "Chevrolet - Onix 1.4MT LT 2015/2016", "Veículo Fiat Palio Fire Flex ano/modelo: 2008",
 * "SUCATA DE FIAT MOBI LIKE, 2021/2021", "MICRO-ÔNIBUS IVECO CITYCLASS 70C17 ANO 2014 / MODELO 2014". O veículo é o
 * texto antes do primeiro ano, vírgula ou parêntese; a marca é a primeira palavra (ou as duas, nas marcas acima).
 * Lote de vários itens ("LOTE COM 15 SCOOTERS…") fica sem marca e modelo.
 */
export function parseSuperbidTitle(title: string): TitleParts {
  let head = plainUpper(title).replace(/\s+/g, " ");
  const salvage = /\bSUCATA\b/.test(head);
  head = head.replace(/^SUCATA( DE| DO)?\s+/, "");
  let type = "";
  // Ruído e tipo podem vir um depois do outro ("VEÍCULO BAIXADO NO DETRAN…", "PARA PRENSA/CAMINHÃO/…").
  for (let pass = 0; pass < 3; pass++) {
    type ||= TYPE_PREFIX.exec(head)?.[1] ?? "";
    head = LEADING_NOISE.reduce((text, noise) => text.replace(noise, ""), head.replace(TYPE_PREFIX, ""));
  }
  const base = { salvage, heavy: HEAVY_TYPE.test(type), years: yearsOf(head) };
  const vehicle = nonEmpty(head.split(/,|\(|\bANO\b|\b(?:19|20)\d{2}\b/)[0]);
  if (vehicle === null || /^LOTE\b/.test(vehicle)) return { ...base, brand: null, model: null };
  if (/^\S+\s*\//.test(vehicle)) return { ...base, ...splitDetranVehicle(vehicle.replace(/\s*\/\s*/, "/")) };
  // "KOMBI - VW", "COURIER 1.6 L - FORD": o modelo antes, a marca depois.
  const brandLast = /^(.+?) - (\S+)$/.exec(vehicle);
  const [, before = "", after = ""] = brandLast ?? [];
  if (isKnownVehicleBrand(after) && !isKnownVehicleBrand(before.split(" ")[0] ?? "")) {
    return { ...base, brand: after, model: nonEmpty(before) };
  }
  const dashed = /^(\S+(?: \S+)?) - (.+)$/.exec(vehicle);
  if (dashed) return { ...base, brand: nonEmpty(dashed[1]), model: nonEmpty(dashed[2]) };
  const twoWords = TWO_WORD_BRANDS.find((brand) => vehicle === brand || vehicle.startsWith(`${brand} `));
  const brand = twoWords ?? vehicle.split(" ")[0] ?? null;
  // "HONDA HONDA CR-V EXL": a marca repetida não faz parte do modelo.
  const model = vehicle.slice(brand?.length ?? 0).trim();
  const repeated = brand !== null && model.startsWith(`${brand} `) ? model.slice(brand.length) : model;
  return { ...base, brand: nonEmpty(brand), model: nonEmpty(repeated) };
}

/** Marca, modelo e anos: campos da API, depois linhas rotuladas da descrição, depois o título. */
function vehicleOf(raw: SuperbidRaw) {
  const labeled = labeledOf(raw.description);
  const fromVehicle = labeled.vehicle === null ? null : splitDetranVehicle(labeled.vehicle.replace(/\s*\/\s*/, "/"));
  const title = parseSuperbidTitle(raw.title);
  const years = yearsFrom(labeled, title.years);
  return {
    salvage: title.salvage || /\bSUCATA\b/.test(plainUpper(raw.subcategory ?? "")),
    heavy: title.heavy,
    brand: brandOf(upper(raw.brand) ?? labeled.brand ?? fromVehicle?.brand ?? title.brand),
    model: upper(raw.model) ?? labeled.model ?? fromVehicle?.model ?? title.model,
    years,
    mileageKm: labeled.mileageKm,
    color: labeled.color,
    fuel: labeled.fuel,
  };
}

/** "GM/CHEVROLET", "I/GM", "IMP/HONDA": o prefixo da montadora ou de importado não é a marca. */
function brandOf(brand: string | null): string | null {
  return brand === null ? null : (/^(?:GM|I|IMP\.?)\s*\/\s*(.+)$/.exec(brand)?.[1] ?? brand);
}

function categoryOf(
  raw: SuperbidRaw,
  vehicle: { salvage: boolean; heavy: boolean; brand: string | null; model: string | null },
): ListingCategory | null {
  if (vehicle.salvage) return "Sucatas";
  if (vehicle.heavy) return "Pesados";
  if (raw.categoryId === SUPERBID_CATEGORY_IDS.motorcycles) return "Motos";
  if (raw.categoryId !== SUPERBID_CATEGORY_IDS.cars) return null;
  // Alguns vendedores publicam motos em "Carros > Hatches" ("HONDA/CG 150 TITAN KS", "YAMAHA/YBR 125K").
  if (categoryOfVehicle(vehicle.brand, vehicle.model) === "Motos") return "Motos";
  return raw.subcategoryId !== null && UTILITY_SUBCATEGORY_IDS.has(raw.subcategoryId) ? "Utilitarios" : "Carros";
}

/** Título sem o final da placa e as referências internas do vendedor ("(ID.: 51671)", "(Ref.: 53136)"). */
function titleOf(raw: SuperbidRaw): string {
  const title = raw.title
    .replace(/,?\s*\bPLACA\b.*$/i, "")
    .replace(/\s*\((?:ID|REF)\.?:[^)]*\)/gi, "")
    .replace(/\s*\bID\.?:?\s*#\S+/i, "")
    .replace(/[\s,]+$/, "")
    .trim();
  return title === "" ? `Veículo sem descrição (lote ${raw.lotNumber ?? raw.offerId})` : title;
}

/** "Jundiaí - SP" → cidade e UF; a UF também vem por extenso em `state`. */
function placeOf(raw: SuperbidRaw): { city: string | null; state: string | null } {
  const city = raw.location.city;
  const match = city === null ? null : /^(.*?)\s+-\s+([A-Z]{2})$/.exec(city.trim());
  const state =
    (match?.[2] ? stateCode(match[2]) : null) ?? (raw.location.state ? stateCode(raw.location.state) : null);
  return { city: nonEmpty(match ? match[1] : city), state };
}

function feeOf(raw: SuperbidRaw, name: string): Cents | null {
  const values = raw.fees.filter((fee) => plainUpper(fee.name ?? "") === name).map((fee) => fee.value);
  return values.length === 0 ? null : reaisToCents(values.reduce((sum, value) => sum + value, 0));
}

function otherFeesOf(raw: SuperbidRaw): Cents | null {
  const values = raw.fees.filter((fee) => !KNOWN_FEES.has(plainUpper(fee.name ?? ""))).map((fee) => fee.value);
  return values.length === 0 ? null : reaisToCents(values.reduce((sum, value) => sum + value, 0));
}
const KNOWN_FEES: ReadonlySet<string> = new Set(["ESTADIA", "REMOCAO"]);

/** Linha da descrição curta o bastante para ser dado do lote, e não texto padrão de edital. */
const MAX_NOTE_LINE = 160;

/**
 * As descrições trazem longos textos padrão ("…airbags acionados ou ausentes…") e negações ("Rastreador e GNV
 * não/não aplicável"), que marcariam todo lote. Marcações saem só do título; o nível de dano, do título, da
 * subcategoria e das linhas curtas da descrição ("VEÍCULO RECUPERADO MÉDIA MONTA.").
 */
function conditionOf(raw: SuperbidRaw, salvage: boolean): ListingCondition {
  const fromTitle = parseConditionNotes(raw.title);
  const notes = [raw.title, raw.subcategory ?? "", ...raw.description.filter((line) => line.length <= MAX_NOTE_LINE)];
  const level = parseConditionNotes(notes.join("\n")).damageLevel;
  const damageLevel = salvage ? worstDamage(level, "salvage") : level;
  return { ...EMPTY_CONDITION, damageLevel, flags: fromTitle.flags };
}

function descriptionOf(raw: SuperbidRaw): string | null {
  return raw.description.length > 0 ? raw.description.join("\n") : null;
}

export function buildSuperbidListing(raw: SuperbidRaw, now: Date): ListingInput {
  const vehicle = vehicleOf(raw);
  const place = placeOf(raw);
  const auctionEndsAt = raw.auction.endsAt === null ? null : new Date(raw.auction.endsAt);
  const hasBids = raw.bidCount > 0 && raw.price !== null;

  return {
    externalId: raw.offerId,
    url: superbidListingUrl(raw.offerId),
    lotNumber: raw.lotNumber,
    title: titleOf(raw),
    vehicle: {
      brand: vehicle.brand,
      model: vehicle.model,
      fipeCode: null,
      fipeName: null,
      modelYear: vehicle.years.modelYear,
      manufactureYear: vehicle.years.manufactureYear,
      mileageKm: vehicle.mileageKm,
      fuel: vehicle.fuel,
      color: vehicle.color,
      category: categoryOf(raw, vehicle),
      recoveryType: null,
      hasKey: null,
    },
    // Os lotes de um evento encerram juntos, no fim dele: é a data do leilão.
    auction: { externalId: raw.auction.id, name: raw.auction.name, startsAt: auctionEndsAt },
    sellerName: raw.seller,
    description: descriptionOf(raw),
    condition: conditionOf(raw, vehicle.salvage),
    startsAt: raw.auction.opensAt === null ? null : new Date(raw.auction.opensAt),
    endsAt: raw.endsAt === null ? null : new Date(raw.endsAt),
    location: { yardName: null, city: place.city, state: place.state, address: null },
    status: mapStatus(raw, now),
    sourceStatus: String(raw.statusCode),
    // Com lance, `price` é o maior lance; sem lance, é o lance inicial.
    currentBid: hasBids && raw.price !== null ? reaisToCents(raw.price) : null,
    minimumBid: raw.initialBid === null || raw.initialBid === 0 ? null : reaisToCents(raw.initialBid),
    bidCount: raw.bidCount,
    // A API não informa valor de mercado: o coletor casa na FIPE (D-47).
    marketValue: null,
    costs: {
      commissionRate: raw.commissionPercent === null ? null : bps(Math.round(raw.commissionPercent * 100)),
      dispatcherFee: null,
      removalFee: feeOf(raw, "REMOCAO"),
      storageFee: feeOf(raw, "ESTADIA"),
      inspectionFee: null,
      otherFees: otherFeesOf(raw),
    },
    photoUrls: raw.photos.filter((url) => url.startsWith(PHOTO_PREFIX)),
    raw,
  };
}

export function superbidDetailsFromRaw(raw: unknown, now: Date): ListingDetails | null {
  const parsed = readSuperbidRaw(raw);
  if (!parsed) return null;
  return {
    description: descriptionOf(parsed),
    condition: conditionOf(parsed, vehicleOf(parsed).salvage),
    status: mapStatus(parsed, now),
    sourceStatus: String(parsed.statusCode),
  };
}

/** Data em texto no fuso de São Paulo, sem horário de verão desde 2019 ("2026-10-09 16:54:00" → UTC). */
function localToIso(text: string | null | undefined): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/.exec(text ?? "");
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2]}-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return null;
  }
}

function toYear(text: string | undefined): number | null {
  const year = text === undefined ? Number.NaN : Number(text);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
}

function plainUpper(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

function upper(text: string | null): string | null {
  return text === null ? null : nonEmpty(plainUpper(text));
}

function nonEmpty(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}
