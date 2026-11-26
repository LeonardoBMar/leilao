import { z } from "zod";

import { EMPTY_CONDITION, type ListingCondition } from "@/domain/listings/condition";
import { stateCode } from "@/domain/listings/place";
import type { ListingCategory, ListingInput, ListingStatus } from "@/domain/listings/types";
import { bps } from "@/domain/money";
import { formatDate } from "@/lib/format";
import { err, ok, type Result } from "@/lib/result";

import { ASTAVERO_IMAGE_ORIGIN } from "../image-origins";
import { splitDetranVehicle } from "../shared/detran-vehicle";
import { htmlToLines, nonEmpty, parseJson, parseYear as toYear, plainUpper, reaisToCents } from "../shared/extract";
import { redactVehicleIds } from "../shared/redact";
import type { ListingDetails, ParseError } from "../types";
import {
  astaveroListedLotSchema,
  astaveroListSchema,
  type AstaveroLot,
  astaveroLotResponseSchema,
  astaveroLotSchema,
} from "./schema";

export const DETRAN_SC_NAME = "Detran-SC";
export const DETRAN_SC_BASE_URL = "https://www.detran.sc.gov.br/leiloes/";

/**
 * Leiloeiros do rodízio do Detran-SC que usam a plataforma Astavero: a mesma aplicação e a mesma API em cada site.
 * Os demais do rodízio usam outras plataformas (docs/FONTES-PENDENTES.md, linha 29).
 */
export const ASTAVERO_SITE_KEYS = ["maxter", "krobel", "deltta", "damiani"] as const;
export type AstaveroSite = (typeof ASTAVERO_SITE_KEYS)[number];
export const ASTAVERO_SITES: Readonly<Record<AstaveroSite, { name: string; baseUrl: string }>> = {
  maxter: { name: "Maxter Leilões", baseUrl: "https://www.maxterleiloes.com.br" },
  krobel: { name: "Krobel Leilões", baseUrl: "https://www.krobelleiloes.com.br" },
  deltta: { name: "Deltta Leilões", baseUrl: "https://www.delttaleiloes.com.br" },
  damiani: { name: "Damiani Leilões", baseUrl: "https://www.damianileiloes.com.br" },
};

/** Fotos ficam num bucket da Oracle Cloud, o mesmo para todos os sites da plataforma. */
const PHOTO_PREFIX = `${ASTAVERO_IMAGE_ORIGIN}/n/grlkbn1ggqso/b/astavero/o/`;

/** Ids do site são ObjectIds do MongoDB; outra coisa a API responde com erro 504 depois de 30 s. */
const OBJECT_ID = "[0-9a-f]{24}";

export type DetranScLotRef = { site: AstaveroSite; auctionId: string; lotId: string };

/** Id do anúncio: `{site}-{leilão}-{lote}`. O site diz em qual API perguntar; o leilão compõe a URL da página. */
export const detranScExternalId = ({ site, auctionId, lotId }: DetranScLotRef) => `${site}-${auctionId}-${lotId}`;

export function parseDetranScExternalId(externalId: string): DetranScLotRef | null {
  const match = new RegExp(`^([a-z]+)-(${OBJECT_ID})-(${OBJECT_ID})$`).exec(externalId);
  const site = ASTAVERO_SITE_KEYS.find((key) => key === match?.[1]);
  return site && match?.[2] && match[3] ? { site, auctionId: match[2], lotId: match[3] } : null;
}

export const detranScLotUrl = ({ site, auctionId, lotId }: DetranScLotRef) =>
  `${ASTAVERO_SITES[site].baseUrl}/pregao/${auctionId}/${lotId}`;

export function detranScListingUrl(externalId: string): string {
  const ref = parseDetranScExternalId(externalId);
  return ref ? detranScLotUrl(ref) : externalId;
}

export const astaveroListUrl = (site: AstaveroSite) => `${ASTAVERO_SITES[site].baseUrl}/app/lotes`;
export const astaveroLotApiUrl = (site: AstaveroSite) => `${ASTAVERO_SITES[site].baseUrl}/app/pregao/lote`;

/** Comitente dos leilões do Detran-SC, sem acento: "DEPARTAMENTO ESTADUAL DE TRÂNSITO" ou "... - DETRAN SC". */
function isDetran(vara: string): boolean {
  const plain = plainUpper(vara);
  return plain.startsWith("DEPARTAMENTO ESTADUAL DE TRANSITO") || /\bDETRAN\b/.test(plain);
}

/**
 * Lotes do Detran-SC na lista de lotes abertos do site. A lista é inteira numa resposta; se o total anunciado for
 * maior do que o que veio, ela está cortada e a descoberta não é completa.
 */
export function parseAstaveroList(
  json: string,
  site: AstaveroSite,
): Result<{ lots: DetranScLotRef[]; truncated: boolean }, ParseError> {
  const list = astaveroListSchema.safeParse(parseJson(json));
  if (!list.success) return err("missing_data");
  const lots: DetranScLotRef[] = [];
  for (const item of list.data.lotes) {
    const lot = astaveroListedLotSchema.safeParse(item);
    if (!lot.success) return err("invalid_data");
    const ref = { site, auctionId: lot.data.leilao, lotId: lot.data.id };
    if (isDetran(lot.data.vara) && parseDetranScExternalId(detranScExternalId(ref))) lots.push(ref);
  }
  const count = list.data.pag?.count ?? list.data.lotes.length;
  return ok({ lots, truncated: count > list.data.lotes.length });
}

/**
 * Dado bruto guardado em `listings.raw`: o lote como o site o descreve, já sem placa, motor e chassi da ficha e sem nada
 * de quem deu lance (de cada lance, só o valor). Valores em reais, como o site escreve.
 */
export const detranScRawSchema = z.object({
  site: z.enum(ASTAVERO_SITE_KEYS),
  auctionId: z.string(),
  lotId: z.string(),
  lotNumber: z.string(),
  /** "AUTOMÓVEL FIAT/PALIO EX Ano: 2001/2002". */
  name: z.string(),
  status: z.string(),
  /** Motivo da retirada, quando o site informa. */
  reason: z.string().nullable(),
  salvage: z.boolean(),
  /** Linhas da ficha além do nome e do ano, sem identificadores do veículo. */
  details: z.array(z.string()),
  appraisal: z.number().nullable(),
  startingBid: z.number().nullable(),
  commissionPercent: z.number().nullable(),
  yard: z.object({
    name: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    address: z.string().nullable(),
  }),
  auctionAt: z.iso.datetime().nullable(),
  opensAt: z.iso.datetime().nullable(),
  closedAt: z.iso.datetime().nullable(),
  photos: z.array(z.string()),
  /** Valores dos lances, do maior para o menor. */
  bids: z.array(z.number()),
});
export type DetranScRaw = z.infer<typeof detranScRawSchema>;

export function readDetranScRaw(raw: unknown): DetranScRaw | null {
  const parsed = detranScRawSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Resposta de `POST /app/pregao/lote`. `ok(null)`: o site não conhece o lote. */
export function parseAstaveroLot(json: string, ref: DetranScLotRef): Result<DetranScRaw | null, ParseError> {
  const response = astaveroLotResponseSchema.safeParse(parseJson(json));
  if (!response.success) return err("missing_data");
  if (response.data.lote === null) return ok(null);
  const lot = astaveroLotSchema.safeParse(response.data.lote);
  if (!lot.success) return err("invalid_data");
  if (lot.data._id !== ref.lotId) return err("invalid_data");
  return ok(rawOf(lot.data, ref));
}

function rawOf(lot: AstaveroLot, ref: DetranScLotRef): DetranScRaw {
  const yard = lot.d;
  const address = [yard?.endereco, yard?.bairro].map((part) => nonEmpty(part)).filter((part) => part !== null);
  return {
    ...ref,
    lotNumber: lot.lote,
    name: lot.nome.replace(/\s+/g, " ").trim(),
    status: lot.status,
    reason: lot.motivo ? nonEmpty(redactVehicleIds(lot.motivo)) : null,
    salvage: lot.sucata === true,
    details: detailsOf(lot.detalhada),
    appraisal: lot.v.avaliacao ?? null,
    startingBid: lot.v.primeira ?? null,
    commissionPercent: lot.v.comissao ?? null,
    yard: {
      name: nonEmpty(yard?.nome),
      city: nonEmpty(yard?.cidade),
      state: nonEmpty(yard?.uf),
      address: address.length > 0 ? address.join(" - ") : null,
    },
    auctionAt: isoOrNull(lot.datas.leilao),
    opensAt: isoOrNull(lot.datas.inicial),
    closedAt: isoOrNull(lot.datas.encerrado),
    photos: (lot.anexos ?? [])
      .filter((file) => file.type.startsWith("image/") && file.private !== true && file.url.startsWith(PHOTO_PREFIX))
      .map((file) => file.url),
    bids: (lot.l ?? []).map((bid) => bid.valor).sort((a, b) => b - a),
  };
}

/** Linhas da ficha que identificam o veículo e não são guardadas (decisão do usuário, docs/PLANO-COLETA.md §2.2). */
const VEHICLE_ID_LINE = /^(PLACA|MOTOR|CHASSI|REM|RENAVAM)\b/;

/** Ficha sem o nome, o ano e os identificadores do veículo; o que sobrar (observações) vira descrição. */
function detailsOf(html: string | null | undefined): string[] {
  if (!html) return [];
  const [, ...rest] = htmlToLines(html);
  return rest
    .filter((line) => !/^ANO\s*:/i.test(line) && !VEHICLE_ID_LINE.test(plainUpper(line)))
    .map((line) => redactVehicleIds(line));
}

/** "AUTOMÓVEL FIAT/PALIO EX Ano: 2001/2002" → tipo, veículo e anos (fabricação/modelo). */
export function parseDetranScName(name: string): {
  type: string | null;
  vehicle: string | null;
  manufactureYear: number | null;
  modelYear: number | null;
} {
  const match = /^(.*?)\s*\bAno\s*:\s*(\d{4})\s*\/\s*(\d{4})\s*$/i.exec(name);
  const head = (match ? (match[1] ?? "") : name).trim();
  const [first = "", ...rest] = head.split(" ");
  const type = TYPE_CATEGORIES.has(plainUpper(first)) ? plainUpper(first) : null;
  return {
    type,
    vehicle: nonEmpty(type === null ? head : rest.join(" ")),
    manufactureYear: toYear(match?.[2]),
    modelYear: toYear(match?.[3]),
  };
}

/** Tipo do veículo como o Detran escreve no nome do lote. Reboque e outros ficam sem categoria. */
const TYPE_CATEGORIES: ReadonlyMap<string, ListingCategory | null> = new Map([
  ["AUTOMOVEL", "Carros"],
  ["MOTOCICLETA", "Motos"],
  ["MOTONETA", "Motos"],
  ["CICLOMOTOR", "Motos"],
  ["CAMINHONETE", "Utilitarios"],
  ["CAMIONETA", "Utilitarios"],
  ["UTILITARIO", "Utilitarios"],
  ["CAMINHAO", "Pesados"],
  ["ONIBUS", "Pesados"],
  ["MICROONIBUS", "Pesados"],
  ["MICRO-ONIBUS", "Pesados"],
  ["SUCATA", "Sucatas"],
  ["REBOQUE", null],
  ["SEMI-REBOQUE", null],
  ["TRICICLO", null],
  ["QUADRICICLO", null],
]);

/**
 * Situações da plataforma (lidas no código da tela): "Aberto", "Pregão" e "Venda direta" aceitam lance; "Vendido",
 * "Sem oferta" e "Retirado" encerram. Vendido sem nenhum lance não tem preço final e fica desconhecido. Situação nova
 * segue aberta até o pregão e depois fica desconhecida.
 */
function mapStatus(raw: DetranScRaw, now: Date): ListingStatus {
  switch (raw.status) {
    case "Aberto":
    case "Pregão":
    case "Venda direta":
      return "open";
    case "Vendido":
      return raw.bids.length > 0 ? "sold" : "unknown";
    case "Sem oferta":
      return "unsold";
    case "Retirado":
      return "withdrawn";
    default: {
      const endsAt = endsAtOf(raw);
      return endsAt !== null && endsAt.getTime() > now.getTime() ? "open" : "unknown";
    }
  }
}

/** Fim do lote: o fechamento registrado ou, antes dele, o início do pregão (os lotes fecham um a um a partir dali). */
function endsAtOf(raw: DetranScRaw): Date | null {
  const at = raw.closedAt ?? raw.auctionAt;
  return at === null ? null : new Date(at);
}

export function buildDetranScListing(raw: DetranScRaw, now: Date): ListingInput {
  const name = parseDetranScName(raw.name);
  const { brand, model } = splitDetranVehicle(name.vehicle);
  const salvage = raw.salvage || name.type === "SUCATA";
  const topBid = raw.bids[0];
  const site = ASTAVERO_SITES[raw.site];
  const auctionAt = raw.auctionAt === null ? null : new Date(raw.auctionAt);

  return {
    externalId: detranScExternalId(raw),
    url: detranScLotUrl(raw),
    lotNumber: raw.lotNumber,
    title: titleOf(name, salvage) ?? `Veículo sem marca e modelo informados (lote ${raw.lotNumber})`,
    vehicle: {
      brand,
      model,
      fipeCode: null,
      fipeName: null,
      modelYear: name.modelYear,
      manufactureYear: name.manufactureYear,
      mileageKm: null,
      fuel: null,
      color: null,
      category: salvage ? "Sucatas" : name.type === null ? null : (TYPE_CATEGORIES.get(name.type) ?? null),
      recoveryType: null,
      hasKey: null,
    },
    auction: {
      externalId: raw.auctionId,
      name:
        auctionAt === null
          ? `Leilão Detran-SC (${site.name})`
          : `Leilão Detran-SC de ${formatDate(auctionAt)} (${site.name})`,
      startsAt: auctionAt,
    },
    sellerName: "DETRAN/SC",
    description: descriptionOf(raw),
    condition: conditionOf(salvage),
    startsAt: raw.opensAt === null ? null : new Date(raw.opensAt),
    endsAt: endsAtOf(raw),
    location: {
      yardName: raw.yard.name,
      city: raw.yard.city,
      state: raw.yard.state === null ? null : stateCode(raw.yard.state),
      address: raw.yard.address,
    },
    status: mapStatus(raw, now),
    sourceStatus: raw.status,
    currentBid: topBid === undefined ? null : reaisToCents(topBid),
    minimumBid: raw.startingBid === null || raw.startingBid === 0 ? null : reaisToCents(raw.startingBid),
    bidCount: raw.bids.length,
    // A avaliação do Detran é o lance inicial, não o valor de mercado: o coletor casa na FIPE (D-47).
    marketValue: null,
    costs: {
      commissionRate: raw.commissionPercent === null ? null : bps(Math.round(raw.commissionPercent * 100)),
      dispatcherFee: null,
      removalFee: null,
      storageFee: null,
      inspectionFee: null,
      otherFees: null,
    },
    photoUrls: raw.photos.filter((url) => url.startsWith(PHOTO_PREFIX)),
    raw,
  };
}

export function detranScDetailsFromRaw(raw: unknown, now: Date): ListingDetails | null {
  const parsed = readDetranScRaw(raw);
  if (!parsed) return null;
  return {
    description: descriptionOf(parsed),
    condition: conditionOf(parsed.salvage || parseDetranScName(parsed.name).type === "SUCATA"),
    status: mapStatus(parsed, now),
    sourceStatus: parsed.status,
  };
}

/** Sem o tipo ("AUTOMÓVEL"), que vira categoria; sucata mantém a palavra no título. */
function titleOf(name: ReturnType<typeof parseDetranScName>, salvage: boolean): string | null {
  if (name.vehicle === null) return null;
  return salvage ? `SUCATA ${name.vehicle}` : name.vehicle;
}

function descriptionOf(raw: DetranScRaw): string | null {
  const lines = [...raw.details, ...(raw.reason === null ? [] : [`Motivo da retirada: ${raw.reason}`])];
  return lines.length > 0 ? lines.join("\n") : null;
}

/** Sucata é veículo para desmonte (sem volta à circulação). A ficha não declara outros danos. */
function conditionOf(salvage: boolean): ListingCondition {
  return salvage ? { ...EMPTY_CONDITION, damageLevel: "salvage" } : EMPTY_CONDITION;
}

function isoOrNull(text: string | null | undefined): string | null {
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
