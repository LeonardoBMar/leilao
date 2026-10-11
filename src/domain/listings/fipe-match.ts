import { type Cents, cents } from "../money";
import { type FuelKey, fuelOf } from "./criteria";
import { percentile } from "./estimates";
import { normalizePlaceName } from "./place";
import type { ListingCategory, ListingStatus } from "./types";
import { baseModelOf, BRAND_ALIASES } from "./vehicle-key";

/**
 * Valor de mercado casado na tabela FIPE oficial para anúncio cuja fonte não informa (D-47; plano em
 * docs/PLANO-VALOR-MERCADO.md §3). Puro: o servidor busca as listas da FIPE e esta regra escolhe. Quando o casamento
 * não é seguro, não há valor; nunca se inventa um número.
 */

/** Tipos de veículo da FIPE: 1 carros e utilitários, 2 motos, 3 caminhões e ônibus. */
export type FipeVehicleType = 1 | 2 | 3;

const TYPE_BY_CATEGORY: Partial<Record<ListingCategory, FipeVehicleType>> = {
  Carros: 1,
  Utilitarios: 1,
  Motos: 2,
  Pesados: 3,
};

/** Sem categoria de veículo (sucata sem tipo, equipamentos, imóveis) não se tenta. */
export function fipeVehicleType(category: ListingCategory | null): FipeVehicleType | null {
  return category === null ? null : (TYPE_BY_CATEGORY[category] ?? null);
}

/**
 * Tipos a tentar, em ordem. Picape grande e utilitário ficam entre carros e caminhões conforme a fonte (a RAM 2500
 * vem como "pesado", mas a FIPE a lista em carros): se a marca não está no primeiro tipo, tenta o outro.
 */
export function fipeVehicleTypes(category: ListingCategory | null): FipeVehicleType[] {
  const type = fipeVehicleType(category);
  if (type === null) return [];
  if (category === "Utilitarios") return [1, 3];
  if (category === "Pesados") return [3, 1];
  return [type];
}

/**
 * Códigos de combustível da FIPE a consultar, por preferência: 1 gasolina, 2 álcool, 3 diesel, 4 elétrico, 5 flex.
 * Os modelos de todos eles entram juntos na escolha: a FIPE lista a moto flex antiga como gasolina e a nova como flex.
 */
export function fipeFuelCodes(type: FipeVehicleType, fuel: string | null): number[] {
  const key = fuelOf(fuel);
  if (key === "diesel") return [3];
  if (key === "eletrico") return [4];
  if (type === 2) return [1, 5];
  if (type === 3) return [3, 1];
  if (key === "flex") return [5, 1, 2];
  if (key === "gasolina") return [1, 5];
  return [5, 1, 3];
}

/** Grafias de marca das fontes que a FIPE escreve por extenso (além de `BRAND_ALIASES`). Chaves normalizadas. */
const FIPE_BRAND_NAMES: Readonly<Record<string, string>> = {
  CHEV: "CHEVROLET",
  "M.BENZ": "MERCEDES BENZ",
  MBENZ: "MERCEDES BENZ",
  "M BENZ": "MERCEDES BENZ",
  MMC: "MITSUBISHI",
  LR: "LAND ROVER",
  CAOACHERY: "CAOA CHERY",
};

/** Item das listas da FIPE (marca ou modelo): código e nome como a FIPE escreve. */
export type FipeOption = { code: string; label: string };

/**
 * Marca do anúncio na lista da FIPE. A FIPE escreve "VW - VolksWagen", "GM - Chevrolet", "Caoa Chery/Chery": cada
 * parte vale como nome. Sem parte igual, aceita a marca como palavra inteira do nome ("KIA" em "Kia Motors").
 */
export function matchFipeBrand(brand: string | null, brands: readonly FipeOption[]): FipeOption | null {
  if (brand === null) return null;
  // "I/FIAT" (importado) é FIAT.
  const plain = normalizePlaceName(brand).replace(/^(I|IMP)\//, "");
  const normalized = FIPE_BRAND_NAMES[plain] ?? plain;
  const names = new Set([normalized, BRAND_ALIASES[normalized] ?? normalized]);
  const partsOf = (label: string) =>
    label
      .split(/\s+-\s+|\//)
      .map((part) => normalizePlaceName(part))
      .map((part) => BRAND_ALIASES[part] ?? part);
  const exact = brands.find((option) => partsOf(option.label).some((part) => names.has(part)));
  if (exact) return exact;
  return (
    brands.find((option) =>
      normalizePlaceName(option.label)
        .split(" ")
        .some((word) => names.has(word)),
    ) ?? null
  );
}

export type FipeModelChoice =
  /** Uma versão isolada no topo. */
  | { kind: "version"; code: string }
  /** Versões empatadas no topo: o valor é a mediana delas, se forem parecidas. */
  | { kind: "family"; codes: string[] }
  | { kind: "none"; reason: "no_model" | "no_candidates" | "too_many" };

/**
 * Mais versões empatadas que isto: o modelo do anúncio não diz quase nada. Até aqui, a família só vale se as versões
 * custarem quase o mesmo (`MAX_FAMILY_SPREAD`), então o limite é só contra o anúncio de uma palavra só.
 */
export const MAX_FAMILY_CANDIDATES = 30;

type Scored = { code: string; score: number };

/**
 * Escolhe as versões da FIPE para o modelo do anúncio. Candidatas: mesmo modelo base (`baseModelOf`, a regra das
 * estimativas; "CG150" casa com "CG 150"). Fora as que contradizem a cilindrada. Pontua os outros sinais do título
 * (cilindrada, acabamento, câmbio, portas) e fica com a de maior nota; empate vira família. Sem nenhuma candidata,
 * uma segunda leitura mais solta (`looseCandidates`) cobre a ordem trocada e as letras coladas no número.
 */
export function chooseFipeModels(model: string | null, candidates: readonly FipeOption[]): FipeModelChoice {
  const base = baseModelOf(model);
  if (base === null || model === null) return { kind: "none", reason: "no_model" };
  const listingWords = normalizePlaceName(model).split(/\s+/).slice(base.words);

  let scored: Scored[] = [];
  for (const candidate of candidates) {
    const candidateBase = baseModelOf(candidate.label);
    if (candidateBase === null) continue;
    const suffix = familySuffix(base.name, candidateBase.name);
    if (suffix === null) continue;
    const signals = versionTokens([...(suffix === "" ? [] : [suffix]), ...listingWords]);
    const labelTokens = new Set(
      versionTokens(
        normalizePlaceName(candidate.label)
          .split(/[^A-Z0-9.]+/)
          .slice(candidateBase.words),
      ),
    );
    if (contradicts(signals, labelTokens)) continue;
    scored.push({ code: candidate.code, score: new Set(signals.filter((token) => labelTokens.has(token))).size });
  }
  if (scored.length === 0) scored = looseCandidates(model, candidates);

  if (scored.length === 0) return { kind: "none", reason: "no_candidates" };
  const best = Math.max(...scored.map((item) => item.score));
  const top = scored.filter((item) => item.score === best);
  const [only] = top;
  if (top.length === 1 && only) return { kind: "version", code: only.code };
  if (top.length > MAX_FAMILY_CANDIDATES) return { kind: "none", reason: "too_many" };
  return { kind: "family", codes: top.map((item) => item.code) };
}

/** Prefixos que a fonte põe e a FIPE escreve depois ("NOVO GOL" é "Gol (novo)"). */
const LEADING_NOISE = new Set(["NOVO", "NOVA"]);

/**
 * Segunda leitura, só quando a primeira não achou candidata. Palavras separadas nas letras coladas ao número
 * ("207PASSION" → 207 PASSION, "CB250F" → CB 250 F) e o modelo em qualquer posição: o da FIPE entre as palavras do
 * anúncio ("YBR" em "FACTOR YBR125 K") ou o do anúncio entre as da FIPE ("FAZER" em "YS 250 FAZER"), este só se
 * um número (cilindrada, versão) ou outra palavra também bater. Modelo de uma letra também exige o número.
 */
function looseCandidates(model: string, candidates: readonly FipeOption[]): Scored[] {
  const words = normalizePlaceName(model).split(/\s+/);
  const listing = looseTokens(LEADING_NOISE.has(words[0] ?? "") ? words.slice(1) : words);
  const [listingBase] = listing;
  if (listingBase === undefined) return [];
  const scored: Scored[] = [];
  for (const candidate of candidates) {
    const label = looseTokens(normalizePlaceName(candidate.label).split(/[^A-Z0-9.]+/));
    const [labelBase] = label;
    if (labelBase === undefined) continue;
    const labelSet = new Set(label);
    const sharesNumber = listing.some((token) => isNumber(token) && labelSet.has(token));
    // Modelo de uma letra ("C 100", "F-250") só com um número em comum: senão o "F" de "13F" vira F-250.
    const anchor =
      listing.includes(labelBase) && !isNumber(labelBase) && (labelBase.length > 1 || sharesNumber) ? labelBase : null;
    // Ou outra palavra do anúncio além do modelo: "CLASSIC LIFE" em "Corsa Sed Classic Life 1.6".
    const sharesWord = listing.some(
      (token) => token !== listingBase && token.length > 1 && !isNumber(token) && labelSet.has(token),
    );
    const reverse =
      anchor === null &&
      !isNumber(listingBase) &&
      labelSet.has(listingBase) &&
      (sharesNumber || (sharesWord && listingBase.length > 1));
    if (anchor === null && !reverse) continue;
    const signals = listing.filter((token) => token !== (anchor ?? listingBase));
    if (contradicts(signals, labelSet)) continue;
    scored.push({ code: candidate.code, score: new Set(signals.filter((token) => labelSet.has(token))).size });
  }
  return scored;
}

/** `versionTokens` e, depois, letras e números colados separados (fora válvulas e cilindrada: "16V", "1.6"). */
function looseTokens(words: readonly string[]): string[] {
  return versionTokens(words.filter(Boolean)).flatMap((token) =>
    /^\d{1,2}V$/.test(token) || isDisplacement(token)
      ? [token]
      : (token.match(/[A-Z]+|\d+/g) ?? []).filter((part) => part !== ""),
  );
}

const isNumber = (token: string) => /^\d+$/.test(token) || isDisplacement(token);

/**
 * O resto do nome quando os modelos base casam: "" se iguais (sem contar hífen: "C100" é "C-100"); os dígitos colados
 * quando um é o outro mais um número ("CG150" e "CG" → "150"). `null` se não casam.
 */
function familySuffix(listingName: string, fipeName: string): string | null {
  const listing = listingName.replaceAll("-", "");
  const fipe = fipeName.replaceAll("-", "");
  if (listing === fipe) return "";
  const [longer, shorter] = listing.length > fipe.length ? [listing, fipe] : [fipe, listing];
  if (!longer.startsWith(shorter)) return null;
  const rest = longer.slice(shorter.length);
  return /^\d+$/.test(rest) ? rest : null;
}

const AUTOMATIC = new Set(["AT", "AUT", "AUTOMATICO", "AUTOM", "CVT", "TIPTRONIC", "DUALOGIC", "IMOTION", "DCT"]);
const MANUAL = new Set(["MT", "MEC", "MANUAL"]);

/**
 * Sinais de versão comparáveis entre anúncio e FIPE: cilindrada como "1.6" (de "1.6", "16", "1000", "16SE",
 * "GLI18", "1.4AT", "10MT"), câmbio como AUT ou MEC, e as demais palavras como estão. "16V" (válvulas) fica.
 */
export function versionTokens(words: readonly string[]): string[] {
  return words
    .flatMap((word) => expandWord(word.replace(/^\.+|\.+$/g, "")))
    .map((token) => (AUTOMATIC.has(token) ? "AUT" : MANUAL.has(token) ? "MEC" : token))
    .filter((token) => token !== "");
}

function expandWord(word: string): string[] {
  if (/^\d\.\d$/.test(word) || /^\d{1,2}V$/.test(word)) return [word];
  if (/^(1000I?|MIL)$/.test(word)) return ["1.0"];
  // Cilindrada colada nas válvulas: "1016V" é 1.0 16V, "148V" é 1.4 8V.
  const withValves = /^(1\d|20)(8|12|16|20|24)V$/.exec(word);
  if (withValves?.[1] && withValves[2]) return [displacement(withValves[1]), `${withValves[2]}V`];
  const bare = /^(1\d|20)$/.exec(word);
  if (bare?.[1]) return [displacement(bare[1])];
  const dotted = /^(\d\.\d)([A-Z]+)$/.exec(word);
  if (dotted?.[1] && dotted[2]) return [dotted[1], dotted[2]];
  const leading = /^(1\d|20)([A-Z]+)$/.exec(word);
  if (leading?.[1] && leading[2]) return [displacement(leading[1]), leading[2]];
  const trailing = /^([A-Z]{2,})(1\d|20)$/.exec(word);
  if (trailing?.[1] && trailing[2]) return [trailing[1], displacement(trailing[2])];
  return [word];
}

const displacement = (digits: string) => `${digits[0] ?? ""}.${digits[1] ?? ""}`;
const isDisplacement = (token: string) => /^\d\.\d$/.test(token);
/** Cilindrada de moto e números de versão ("125", "160", "250"). */
const isEngineSize = (token: string) => /^\d{2,4}$/.test(token);

/** O anúncio diz uma cilindrada e a versão da FIPE diz outra. */
function contradicts(signals: readonly string[], label: ReadonlySet<string>): boolean {
  for (const kind of [isDisplacement, isEngineSize]) {
    const wanted = signals.filter(kind);
    const offered = [...label].filter(kind);
    if (wanted.length > 0 && offered.length > 0 && !wanted.some((token) => label.has(token))) return true;
  }
  return false;
}

export type FipeValue = { value: Cents; fipeCode: string };

export type FipeMatch = {
  origin: "fipe_version" | "fipe_family";
  value: Cents;
  /** Código FIPE da versão casada; nulo na família (várias versões). */
  fipeCode: string | null;
};

/** Família só vale se as versões forem parecidas: P75 ÷ P25 até 1,35 (Gol 1.0 e Gol GTi não viram um número só). */
export const MAX_FAMILY_SPREAD = 1.35;

export function settleFipeValue(choice: FipeModelChoice, values: ReadonlyMap<string, FipeValue>): FipeMatch | null {
  if (choice.kind === "none") return null;
  if (choice.kind === "version") {
    const found = values.get(choice.code);
    return found && found.value > 0 ? { origin: "fipe_version", value: found.value, fipeCode: found.fipeCode } : null;
  }
  const known = choice.codes
    .map((code) => values.get(code)?.value)
    .filter((value): value is Cents => value !== undefined && value > 0)
    .sort((a, b) => a - b);
  // Faltou o valor de alguma versão: a mediana sairia de um grupo diferente do escolhido.
  if (known.length === 0 || known.length < choice.codes.length) return null;
  const low = percentile(known, 0.25);
  const high = percentile(known, 0.75);
  if (low <= 0 || high / low > MAX_FAMILY_SPREAD) return null;
  return { origin: "fipe_family", value: cents(Math.round(percentile(known, 0.5) / 100) * 100), fipeCode: null };
}

/** Primeiro dia do mês, em UTC. */
export function monthOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Mês da tabela FIPE do anúncio: o do fim, se já encerrou (a venda de abril recebe a FIPE de abril); senão, o da
 * primeira coleta.
 */
export function fipeReferenceMonth(listing: { status: ListingStatus; endsAt: Date | null; firstSeenAt: Date }): Date {
  return monthOf(listing.status !== "open" && listing.endsAt !== null ? listing.endsAt : listing.firstSeenAt);
}

export type FipeTable = { code: string; month: Date };

/** Tabela do mês; sem ela (ainda não publicada, ou anterior à primeira), a mais próxima antes, senão a mais antiga. */
export function pickFipeTable(month: Date, tables: readonly FipeTable[]): FipeTable | null {
  const sorted = [...tables].sort((a, b) => b.month.getTime() - a.month.getTime());
  return sorted.find((table) => table.month.getTime() <= month.getTime()) ?? sorted.at(-1) ?? null;
}

const MONTHS = [
  "JANEIRO",
  "FEVEREIRO",
  "MARCO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

/** "outubro/2026 " (como a FIPE escreve) → 1º de outubro de 2026, UTC. */
export function parseFipeMonth(text: string): Date | null {
  const match = /^([A-Z]+)\s*(?:\/|DE)\s*(\d{4})$/.exec(normalizePlaceName(text));
  const month = match?.[1] ? MONTHS.indexOf(match[1]) : -1;
  return match?.[2] && month >= 0 ? new Date(Date.UTC(Number(match[2]), month, 1)) : null;
}

export const MARKET_VALUE_ORIGINS = ["source", "fipe_version", "fipe_family"] as const satisfies readonly (
  "source" | FipeMatch["origin"]
)[];
export type MarketValueOrigin = (typeof MARKET_VALUE_ORIGINS)[number];

type VehicleIdentity = {
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  category: string | null;
};

/**
 * O que a nova leitura de um anúncio faz com o valor de mercado gravado:
 * - `source`: a fonte informou; vale o dela.
 * - `clear`: sem valor e pendente de casamento (anúncio novo, a fonte deixou de informar, ou o veículo mudou e o
 *   valor casado não serve mais).
 * - `keep`: a fonte não informa e o valor casado na FIPE (ou a tentativa sem sucesso) continua valendo.
 */
export function marketValueOnSave(
  previous: (VehicleIdentity & { origin: MarketValueOrigin | null }) | null,
  input: VehicleIdentity & { marketValue: Cents | null },
): { kind: "source"; value: Cents } | { kind: "clear" } | { kind: "keep" } {
  if (input.marketValue !== null) return { kind: "source", value: input.marketValue };
  if (previous === null || previous.origin === "source") return { kind: "clear" };
  const changed =
    previous.brand !== input.brand ||
    previous.model !== input.model ||
    previous.modelYear !== input.modelYear ||
    previous.category !== input.category;
  return changed ? { kind: "clear" } : { kind: "keep" };
}

/**
 * Versão da regra de escolha (D-49). Suba sempre que `chooseFipeModels`, `matchFipeBrand`, os tipos ou os combustíveis
 * mudarem, e diga em `MATCHER_CHANGES` o que a versão nova pode mudar: as correlações automáticas afetadas são refeitas
 * e os anúncios ligados a elas, recalculados.
 */
export const MATCHER_VERSION = 5;

/**
 * O que cada versão da regra muda (D-53). `all`: a escolha de quem já casou pode mudar, e todas as automáticas de
 * versão anterior são refeitas. `unmatched`: a regra só amplia a busca, e só as sem casamento (`none`) são refeitas;
 * as que casaram ficam como estão (sairiam iguais).
 */
export const MATCHER_CHANGES: Readonly<Record<number, "all" | "unmatched">> = {
  1: "all",
  // Catálogo do dataset (D-51): marca pelo nome e versão pelo código FIPE.
  2: "all",
  // Segunda leitura solta (ordem trocada, letras coladas, "NOVO") e famílias de até 30 versões (D-53).
  3: "unmatched",
  // Marcas "GMC" (Chevrolet) e "VOLKSWAGEM" (BRAND_ALIASES), que ficavam sem marca na FIPE.
  4: "unmatched",
  // Segunda leitura aceita o modelo do anúncio entre as palavras da FIPE com outra palavra em comum, sem número.
  5: "unmatched",
};

/** Correlação automática anterior a esta versão é refeita, qualquer que seja o tipo: a última versão `all`. */
export function rematchAllBelow(): number {
  return Math.max(
    0,
    ...Object.entries(MATCHER_CHANGES).flatMap(([version, change]) => (change === "all" ? [Number(version)] : [])),
  );
}

export type FipeVehicle = {
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  fuel: string | null;
  category: ListingCategory | null;
};

/** O que a chave da correlação guarda, já normalizado. */
export type FipeVehicleIdentity = {
  key: string;
  brand: string;
  model: string | null;
  modelYear: number;
  fuel: FuelKey | null;
  category: ListingCategory;
};

/**
 * Chave da correlação (D-49): o veículo como a fonte escreve, normalizado (maiúsculas, sem acento, espaços simples).
 * Anúncios com a mesma chave recebem a mesma escolha de versão. Nula quando não há o que casar.
 */
export function fipeVehicleIdentity(vehicle: FipeVehicle): FipeVehicleIdentity | null {
  const { brand, model, modelYear, fuel, category } = vehicle;
  if (brand === null || modelYear === null || category === null || fipeVehicleType(category) === null) return null;
  const identity = {
    brand: normalizePlaceName(brand),
    model: model === null ? null : normalizePlaceName(model) || null,
    modelYear,
    fuel: fuelOf(fuel),
    category,
  };
  if (identity.brand === "") return null;
  const key = [identity.brand, identity.model ?? "", modelYear, identity.fuel ?? "", category].join("|");
  return { key, ...identity };
}

/** Versão escolhida da FIPE, como a correlação guarda: código, combustível e nome. */
export type FipeMatchModel = { code: string; fuel: number; label: string };

/** Correlação automática de regra antiga é refeita; a manual nunca. */
export function needsRematch(match: {
  origin: "auto" | "manual";
  matcherVersion: number;
  kind: "version" | "family" | "none";
}): boolean {
  if (match.origin !== "auto" || match.matcherVersion >= MATCHER_VERSION) return false;
  return match.kind === "none" || match.matcherVersion < rematchAllBelow();
}
