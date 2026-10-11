import { normalizePlaceName } from "./place";
import { baseModelOf, vehicleKey } from "./vehicle-key";

/**
 * Família do veículo (docs/PLANO-MERCADO.md, T0.2): o nível entre a versão FIPE e o modelo base (`vehicleKey`). Puro.
 *
 * - **Carros e utilitários:** o modelo base mais a carroceria ou a linha que muda o preço por inteiro, quando a fonte
 *   a escreve até três palavras depois do modelo: "ONIX PLUS" (sedã, mediana de R$ 65 mil em 11/10/2026) não é o
 *   "ONIX" hatch (R$ 27 mil). Sem palavra de família, a família é o próprio modelo ("ONIX|").
 * - **Motos:** o modelo base sem os dígitos mais a cilindrada, onde quer que a fonte a escreva: "CG 160 FAN" e
 *   "CG160 TITAN" são a mesma família (`HONDA|CG|160`), e a "CG 125" é outra.
 */

/** Palavras de família de carro (medição de 11/10/2026), com as grafias que dão na mesma. */
const CAR_FAMILIES: Readonly<Record<string, string>> = {
  PLUS: "PLUS",
  SEDAN: "SEDAN",
  WEEKEND: "WEEKEND",
  MILLE: "MILLE",
  CROSS: "CROSS",
  ADVENTURE: "ADVENTURE",
  WAY: "WAY",
  JOY: "JOY",
  JOYE: "JOY",
};

/** Cabine de picape (simples, estendida, dupla): a fonte a escreve em qualquer ponto ("S10 LT 2.8 CD 4X4"). */
const CABS: ReadonlySet<string> = new Set(["CS", "CE", "CD"]);

/** Quantas palavras depois do modelo base a família pode estar ("ONIX 1.0 PLUS" ainda é Plus). */
const FAMILY_LOOKAHEAD = 3;
const MIN_CC = 50;
const MAX_CC = 1_300;

/**
 * Chave "MARCA|MODELO|FAMÍLIA" para agrupar vendas da mesma família, ou `null` sem marca ou modelo (como
 * `vehicleKey`). Motos (`category === "Motos"`) usam a cilindrada como família.
 */
export function vehicleFamilyKey(brand: string | null, model: string | null, category: string | null): string | null {
  const key = vehicleKey(brand, model);
  const base = baseModelOf(model);
  if (key === null || base === null) return null;
  const words = normalizePlaceName(model ?? "")
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const rest = words.slice(base.words);

  if (category === "Motos") {
    const [fullBrand] = key.split("|");
    const letters = base.name.replace(/\d+[A-Z]*$/, "");
    const cc = [base.name, ...rest].map(displacementOf).find((value) => value !== null) ?? null;
    return `${fullBrand}|${letters === "" ? base.name : letters}|${cc ?? ""}`;
  }

  const family =
    rest
      .slice(0, FAMILY_LOOKAHEAD)
      .map((word) => CAR_FAMILIES[word])
      .find((value) => value !== undefined) ?? rest.find((word) => CABS.has(word));
  return `${key}|${family ?? ""}`;
}

/** Cilindrada escrita na palavra ("160", "125I", "300R", "CG150", "YBR125"), entre 50 e 1.300 cc. */
function displacementOf(word: string): number | null {
  const match = /^[A-Z]*(\d{2,4})[A-Z]{0,2}$/.exec(word);
  const value = match?.[1] === undefined ? Number.NaN : Number(match[1]);
  return value >= MIN_CC && value <= MAX_CC ? value : null;
}
