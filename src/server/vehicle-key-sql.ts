import "server-only";

import { BRAND_ALIASES } from "@/domain/listings/estimates";
import { Prisma } from "@/generated/prisma/client";

/**
 * `vehicleKey` (src/domain/listings/estimates.ts) em SQL, para o banco agrupar como as estimativas (D-45). Os padrões
 * de regex vão como parâmetro: no texto do SQL, o `̀` e a crase teriam de sobreviver a dois escapes.
 * `vehicle-key-sql.test.ts` compara os dois lados no banco.
 */

const COMBINING_MARKS = "[̀-ͯ]";
const APOSTROPHES = "['’`]";
const SPACES = "\\s+";
const MODEL_TOKEN = "[A-Z0-9]+";

/** `normalizePlaceName`: sem acento e apóstrofo, hífen vira espaço, maiúsculas, espaços simples. */
function normalizedSql(column: Prisma.Sql): Prisma.Sql {
  const unaccented = Prisma.sql`regexp_replace(normalize(coalesce(${column}, ''), NFD), ${COMBINING_MARKS}, '', 'g')`;
  const cleaned = Prisma.sql`replace(regexp_replace(${unaccented}, ${APOSTROPHES}, '', 'g'), '-', ' ')`;
  return Prisma.sql`btrim(regexp_replace(upper(${cleaned}), ${SPACES}, ' ', 'g'))`;
}

/** Chave "MARCA|MODELO" (marca por extenso, primeira palavra do modelo) ou `NULL` sem marca ou modelo. */
export function vehicleKeySql(brand: Prisma.Sql, model: Prisma.Sql): Prisma.Sql {
  const normalizedBrand = normalizedSql(brand);
  const aliases = Object.entries(BRAND_ALIASES).map(([alias, full]) => Prisma.sql`WHEN ${alias} THEN ${full}`);
  const fullBrand = Prisma.sql`CASE ${normalizedBrand} ${Prisma.join(aliases, " ")} ELSE ${normalizedBrand} END`;
  const baseModel = Prisma.sql`(regexp_match(${normalizedSql(model)}, ${MODEL_TOKEN}))[1]`;
  return Prisma.sql`CASE WHEN ${normalizedBrand} = '' OR ${baseModel} IS NULL THEN NULL ELSE ${fullBrand} || '|' || ${baseModel} END`;
}
