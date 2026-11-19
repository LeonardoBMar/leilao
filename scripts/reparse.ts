// Rederiva do dado bruto (`listings.raw`) descrição, condição e situação dos anúncios já coletados, sem baixar
// páginas. Uso: `npm run db:reparse [-- --source <id>]`, depois de mudar a extração de um adaptador. Idempotente.

import { runCli } from "./lib/cli";

function readSourceFlag(argv: readonly string[]): string | undefined {
  const index = argv.indexOf("--source");
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) throw new Error("Informe o id após --source (ex.: --source leilo).");
  return value;
}

async function main() {
  const sourceId = readSourceFlag(process.argv.slice(2));
  const { reparseListings } = await import("@/server/collector/reparse");
  const { SOURCES } = await import("@/sources");

  const targets = sourceId === undefined ? SOURCES : SOURCES.filter((source) => source.id === sourceId);
  if (targets.length === 0) {
    throw new Error(`Fonte desconhecida: ${sourceId}. Disponíveis: ${SOURCES.map((s) => s.id).join(", ")}.`);
  }

  for (const source of targets) {
    const { scanned, updated, statusChanged, skipped } = await reparseListings(source, new Date());
    process.stdout.write(
      `${source.id}: ${scanned} lidos · ${updated} atualizados · ${statusChanged} com situação nova · ` +
        `${skipped} sem dado bruto reconhecível\n`,
    );
  }
}

runCli(main);
