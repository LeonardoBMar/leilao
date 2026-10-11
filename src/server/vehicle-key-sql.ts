import "server-only";

import { BRAND_ALIASES, MODEL_RENAMES } from "@/domain/listings/vehicle-key";
import { Prisma } from "@/generated/prisma/client";

/**
 * `vehicleKey` (src/domain/listings/estimates.ts) em SQL, para o banco agrupar como as estimativas (D-45). Os padrões
 * de regex vão como parâmetro: no texto do SQL, o `̀` e a crase teriam de sobreviver a dois escapes.
 * `vehicle-key-sql.test.ts` compara os dois lados no banco.
 */

const COMBINING_MARKS = "[̀-ͯ]";
const APOSTROPHES = "['’`]";
const SPACES = "\\s+";
/** As duas primeiras palavras do modelo (a segunda pode faltar). */
const MODEL_TOKENS = "([A-Z0-9]+)(?:[^A-Z0-9]+([A-Z0-9]+))?";
const ONE_LETTER = "^[A-Z]$";
const TWO_LETTERS = "^[A-Z]{2}$";

/** `normalizePlaceName`: sem acento e apóstrofo, hífen vira espaço, maiúsculas, espaços simples. */
function normalizedSql(column: Prisma.Sql): Prisma.Sql {
  const unaccented = Prisma.sql`regexp_replace(normalize(coalesce(${column}, ''), NFD), ${COMBINING_MARKS}, '', 'g')`;
  const cleaned = Prisma.sql`replace(regexp_replace(${unaccented}, ${APOSTROPHES}, '', 'g'), '-', ' ')`;
  return Prisma.sql`btrim(regexp_replace(upper(${cleaned}), ${SPACES}, ' ', 'g'))`;
}

/**
 * Chave "MARCA|MODELO" (marca por extenso, primeira palavra do modelo, com a seguinte quando a primeira é um prefixo
 * curto, como em "T-CROSS" e "HR-V", e as trocas de `MODEL_RENAMES`) ou `NULL` sem marca ou modelo.
 */
export function vehicleKeySql(brand: Prisma.Sql, model: Prisma.Sql): Prisma.Sql {
  const normalizedBrand = normalizedSql(brand);
  const aliases = Object.entries(BRAND_ALIASES).map(([alias, full]) => Prisma.sql`WHEN ${alias} THEN ${full}`);
  const fullBrand = Prisma.sql`CASE ${normalizedBrand} ${Prisma.join(aliases, " ")} ELSE ${normalizedBrand} END`;
  // As duas palavras saem de uma só busca por linha; a regra de `isShortPrefix` (estimates.ts) decide se a segunda entra.
  const shortPrefix = Prisma.sql`words[2] IS NOT NULL AND (words[1] ~ ${ONE_LETTER} OR (words[1] ~ ${TWO_LETTERS} AND words[2] ~ ${ONE_LETTER}))`;
  const baseModel = Prisma.sql`(SELECT CASE WHEN ${shortPrefix} THEN words[1] || '-' || words[2] ELSE words[1] END
    FROM (SELECT regexp_match(${normalizedSql(model)}, ${MODEL_TOKENS}) AS words) AS model_words)`;
  // `MODEL_RENAMES`: a palavra inteira no modelo (entre separadores) troca o modelo base daquela marca.
  const renames = MODEL_RENAMES.map(
    ({ brand: renameBrand, base, word, name }) =>
      Prisma.sql`WHEN ${fullBrand} = ${renameBrand} AND ${baseModel} = ${base}
        AND ${normalizedSql(model)} ~ ${`(^|[^A-Z0-9])${word}([^A-Z0-9]|$)`} THEN ${name}`,
  );
  const renamedModel = Prisma.sql`CASE ${Prisma.join(renames, " ")} ELSE ${baseModel} END`;
  return Prisma.sql`CASE WHEN ${normalizedBrand} = '' OR ${baseModel} IS NULL THEN NULL ELSE ${fullBrand} || '|' || ${renamedModel} END`;
}
