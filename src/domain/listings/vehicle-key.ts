import { normalizePlaceName } from "./place";

/**
 * Chave do veículo para agrupar vendas e análises (D-36, D-45): marca por extenso e modelo base. Puro. Usada pelas
 * estimativas, pela Pesquisa e pelo casamento FIPE; `vehicleKeySql` (src/server) a repete em SQL.
 */

/** Grafias da mesma marca: a fonte escreve o nome completo, o usuário às vezes abrevia. */
export const BRAND_ALIASES: Readonly<Record<string, string>> = {
  VW: "VOLKSWAGEN",
  GM: "CHEVROLET",
  // Leiloeiros e Detrans escrevem "GMC CORSA", "GMC CELTA": a GM do Brasil (Chevrolet), não a marca americana.
  GMC: "CHEVROLET",
  VOLKSWAGEM: "VOLKSWAGEN",
  // normalizePlaceName troca hífen por espaço: "MERCEDES-BENZ" vira "MERCEDES BENZ".
  MERCEDES: "MERCEDES BENZ",
};

/**
 * Marca e modelo base comparáveis entre fonte e Tracker: sem acento, maiúsculas, marca por extenso e só a primeira
 * palavra do modelo ("ONIX PLUS JOY BLACK" → "ONIX", salvo as trocas de `MODEL_RENAMES`). Prefixo curto não é modelo sozinho: uma letra, ou duas letras
 * seguidas de uma, junta-se à palavra seguinte com hífen, venha ela com hífen ou espaço na fonte ("T CROSS" e
 * "T-Cross" → "T-CROSS", "HR-V" → "HR-V", "F 350" → "F-350"). `null` sem marca ou modelo.
 */
export function vehicleKey(brand: string | null, model: string | null): string | null {
  const normalizedBrand = normalizePlaceName(brand ?? "").trim();
  const base = baseModelOf(model);
  if (normalizedBrand === "" || base === null) return null;
  const fullBrand = BRAND_ALIASES[normalizedBrand] ?? normalizedBrand;
  const words = normalizePlaceName(model ?? "").split(/[^A-Z0-9]+/);
  const rename = MODEL_RENAMES.find(
    (item) => item.brand === fullBrand && item.base === base.name && words.includes(item.word),
  );
  return `${fullBrand}|${rename?.name ?? base.name}`;
}

/**
 * Modelos que a fonte escreve com o nome da família antiga e o mercado conhece por outro: "CORSA CLASSIC" (e "CORSA
 * SEDAN CLASSIC") é o Chevrolet Classic, que sem isso ficaria em dois grupos. Só a chave de agrupamento usa a troca; o
 * casamento da FIPE segue `baseModelOf`. `vehicleKeySql` repete a regra.
 */
export const MODEL_RENAMES: readonly { brand: string; base: string; word: string; name: string }[] = [
  { brand: "CHEVROLET", base: "CORSA", word: "CLASSIC", name: "CLASSIC" },
];

/**
 * Modelo base de `vehicleKey` ("ONIX PLUS JOY" → ONIX, "T CROSS" → T-CROSS) e quantas palavras do modelo ele usa.
 * `null` sem modelo.
 */
export function baseModelOf(model: string | null): { name: string; words: number } | null {
  const [first, second] = normalizePlaceName(model ?? "")
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  if (first === undefined) return null;
  return second !== undefined && isShortPrefix(first, second)
    ? { name: `${first}-${second}`, words: 2 }
    : { name: first, words: 1 };
}

/** "T" (T-Cross, F-350, C-180) ou "HR" + "V" (HR-V, CR-V, WR-V); "MT-03", "CG 160" e "KA SE" ficam na família. */
function isShortPrefix(first: string, second: string): boolean {
  return /^[A-Z]$/.test(first) || (/^[A-Z]{2}$/.test(first) && /^[A-Z]$/.test(second));
}
