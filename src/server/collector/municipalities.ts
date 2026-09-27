import "server-only";

import { normalizePlaceName } from "@/domain/listings/place";

import { db } from "../db";

export type MunicipalityRow = { ibgeCode: number; name: string; state: string; latitude: number; longitude: number };

const CHUNK = 1_000;

/**
 * Carga dos municípios do IBGE (prisma/data/municipalities.csv). Idempotente: os já gravados são mantidos.
 * O casamento com a cidade da fonte usa (nome normalizado, UF), que precisa ser único.
 */
export async function seedMunicipalities(rows: readonly MunicipalityRow[]): Promise<number> {
  const data = rows.map((row) => ({ ...row, nameKey: normalizePlaceName(row.name) }));
  const keys = new Set<string>();
  for (const row of data) {
    const key = `${row.nameKey}|${row.state}`;
    if (keys.has(key)) throw new Error(`Município repetido após normalizar: ${key}`);
    keys.add(key);
  }

  let inserted = 0;
  for (let start = 0; start < data.length; start += CHUNK) {
    const { count } = await db.municipality.createMany({
      data: data.slice(start, start + CHUNK),
      skipDuplicates: true,
    });
    inserted += count;
  }
  return inserted;
}
