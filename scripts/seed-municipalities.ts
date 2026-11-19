// Carga dos municípios do IBGE (prisma/data/municipalities.csv, fonte em prisma/data/README.md).
// Uso: `npm run db:seed`. Idempotente: municípios já gravados são mantidos. A gravação fica em src/server.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runCli } from "./lib/cli";

async function main() {
  const { seedMunicipalities } = await import("@/server/collector/municipalities");

  const rows = readFileSync(join(process.cwd(), "prisma", "data", "municipalities.csv"), "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map(parseRow);
  const inserted = await seedMunicipalities(rows);
  process.stdout.write(`Municípios: ${rows.length} no arquivo, ${inserted} inseridos agora.\n`);
}

function parseRow(line: string) {
  const [ibgeCode, name, state, latitude, longitude] = line.split(",");
  const row = {
    ibgeCode: Number(ibgeCode),
    name: name?.trim() ?? "",
    state: state?.trim() ?? "",
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
  if (!Number.isInteger(row.ibgeCode) || !row.name || !/^[A-Z]{2}$/.test(row.state)) {
    throw new Error(`Linha inválida: ${line}`);
  }
  if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) {
    throw new Error(`Coordenadas inválidas: ${line}`);
  }
  return row;
}

runCli(main);
